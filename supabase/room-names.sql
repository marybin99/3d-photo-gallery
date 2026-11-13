-- Apply AFTER artwork-management.sql. Safe for existing projects and re-runs.
begin;
create table if not exists public.gallery_rooms (
  id text primary key check (id in ('A','B','C')),
  name text not null check (name = btrim(name) and char_length(name) between 1 and 24 and name !~ '[[:cntrl:]]'),
  updated_at timestamptz not null default now()
);
insert into public.gallery_rooms (id,name) values ('A','A 전시실'),('B','B 전시실'),('C','C 전시실')
on conflict (id) do nothing;
alter table public.gallery_rooms enable row level security;
revoke all on public.gallery_rooms from public, anon, authenticated;
grant select on public.gallery_rooms to anon, authenticated;
grant update (name) on public.gallery_rooms to authenticated;
drop policy if exists "Anyone reads gallery room names" on public.gallery_rooms;
create policy "Anyone reads gallery room names" on public.gallery_rooms for select to anon, authenticated using (true);
drop policy if exists "Admins rename gallery rooms" on public.gallery_rooms;
create policy "Admins rename gallery rooms" on public.gallery_rooms for update to authenticated
using ((select public.is_gallery_admin())) with check ((select public.is_gallery_admin()));
create or replace function public.stamp_room_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.id := old.id;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists stamp_room_update on public.gallery_rooms;
create trigger stamp_room_update before update on public.gallery_rooms for each row execute function public.stamp_room_update();
commit;
