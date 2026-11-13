-- Run after schema.sql and artwork-management.sql in the Supabase SQL Editor.
-- Safe to re-run. Guestbook writing SQL can be applied before or after this file.
begin;
drop policy if exists "Admins read all notes" on public.guestbook_entries;
create policy "Admins read all notes" on public.guestbook_entries
  for select to authenticated using ((select public.is_gallery_admin()));
grant select on public.guestbook_entries to authenticated;

-- Keep browser table writes closed. Only this checked RPC can moderate notes.
create or replace function public.moderate_guestbook(
  p_id uuid, p_action text, p_expected_visible boolean
)
returns setof public.guestbook_entries
language plpgsql security definer set search_path = '' as $$
declare
  v_entry public.guestbook_entries%rowtype;
begin
  if not public.is_gallery_admin() then
    raise exception 'GUESTBOOK_ADMIN_REQUIRED' using errcode = '42501';
  end if;
  if p_action is null or p_action not in ('show', 'hide', 'delete') then
    raise exception 'GUESTBOOK_INVALID_ACTION' using errcode = '22023';
  end if;
  select * into v_entry from public.guestbook_entries where id = p_id for update;
  if not found or p_expected_visible is distinct from v_entry.is_visible then
    raise exception 'GUESTBOOK_CONFLICT';
  end if;
  if p_action = 'delete' then
    delete from public.guestbook_entries where id = p_id;
  else
    update public.guestbook_entries set is_visible = (p_action = 'show')
      where id = p_id returning * into v_entry;
  end if;
  return next v_entry;
end;
$$;
revoke all on function public.moderate_guestbook(uuid,text,boolean) from public, anon;
grant execute on function public.moderate_guestbook(uuid,text,boolean) to authenticated;
commit;
