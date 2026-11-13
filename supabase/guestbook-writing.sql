-- Apply after schema.sql. Browser clients retain read-only table access.
begin;
revoke insert, update, delete, truncate, references, trigger on public.guestbook_entries from public, anon, authenticated;
grant select on public.guestbook_entries to anon, authenticated;

create table if not exists public.guestbook_write_limits (
  rate_key text primary key,
  last_written_at timestamptz,
  window_start timestamptz not null default now(),
  window_count integer not null default 0
);
create table if not exists public.guestbook_write_receipts (
  request_id uuid primary key,
  rate_key text not null,
  entry_id uuid not null references public.guestbook_entries(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.guestbook_write_limits enable row level security;
alter table public.guestbook_write_receipts enable row level security;
revoke all on public.guestbook_write_limits, public.guestbook_write_receipts from public, anon, authenticated;

create or replace function public.submit_guestbook(
  p_nickname text, p_message text, p_rate_key text, p_request_id uuid
)
returns table(id uuid, nickname text, message text, created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz := clock_timestamp();
  v_client public.guestbook_write_limits%rowtype;
  v_global public.guestbook_write_limits%rowtype;
  v_receipt public.guestbook_write_receipts%rowtype;
  v_entry public.guestbook_entries%rowtype;
begin
  if p_nickname is null or char_length(btrim(p_nickname)) not between 1 and 24
     or p_message is null or char_length(btrim(p_message)) not between 1 and 280
     or p_rate_key is null or p_rate_key !~ '^[a-f0-9]{64}$' or p_request_id is null then
    raise exception 'GUESTBOOK_INVALID_INPUT';
  end if;
  -- All transactions take the global lock first, preventing interleaved checks
  -- and inserts across Edge Function instances and avoiding lock-order deadlocks.
  insert into public.guestbook_write_limits (rate_key) values ('global') on conflict do nothing;
  select * into v_global from public.guestbook_write_limits where rate_key = 'global' for update;
  select * into v_receipt from public.guestbook_write_receipts where request_id = p_request_id;
  if found then
    if v_receipt.rate_key <> p_rate_key then raise exception 'GUESTBOOK_INVALID_INPUT'; end if;
    return query select g.id,g.nickname,g.message,g.created_at from public.guestbook_entries g
      where g.id = v_receipt.entry_id and g.is_visible;
    return;
  end if;
  insert into public.guestbook_write_limits (rate_key) values (p_rate_key) on conflict do nothing;
  select * into v_client from public.guestbook_write_limits where rate_key = p_rate_key for update;
  if v_client.last_written_at is not null and v_now-v_client.last_written_at < interval '60 seconds' then
    raise exception 'GUESTBOOK_RATE_LIMIT';
  end if;
  if v_now-v_client.window_start >= interval '1 hour' then
    v_client.window_start := v_now; v_client.window_count := 0;
  end if;
  if v_now-v_global.window_start >= interval '1 hour' then
    v_global.window_start := v_now; v_global.window_count := 0;
  end if;
  if v_client.window_count >= 5 then raise exception 'GUESTBOOK_HOURLY_LIMIT'; end if;
  if v_global.window_count >= 300 then raise exception 'GUESTBOOK_GLOBAL_LIMIT'; end if;
  insert into public.guestbook_entries (nickname,message)
    values (btrim(p_nickname),btrim(p_message)) returning * into v_entry;
  insert into public.guestbook_write_receipts (request_id,rate_key,entry_id)
    values (p_request_id,p_rate_key,v_entry.id);
  update public.guestbook_write_limits set last_written_at=v_now,
    window_start=v_client.window_start,window_count=v_client.window_count+1 where rate_key=p_rate_key;
  update public.guestbook_write_limits set last_written_at=v_now,
    window_start=v_global.window_start,window_count=v_global.window_count+1 where rate_key='global';
  -- Only old limiter rows are disposable; receipts remain for retry deduplication.
  delete from public.guestbook_write_limits where rate_key<>'global' and last_written_at<v_now-interval '2 days';
  return query select v_entry.id,v_entry.nickname,v_entry.message,v_entry.created_at;
end;
$$;
revoke all on function public.submit_guestbook(text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.submit_guestbook(text,text,text,uuid) to service_role;
commit;
