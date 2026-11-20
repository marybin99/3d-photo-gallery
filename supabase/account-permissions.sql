-- Apply LAST, after guestbook-management.sql, room-opening.sql and youtube-artworks.sql.
-- Reapplying older setup files can restore broad policies; always reapply this file last.
begin;
alter table public.gallery_admins add column if not exists role text not null default 'owner'
  check (role in ('owner','manager','editor'));
alter table public.gallery_admins add column if not exists is_active boolean not null default true;
-- NULL means all rooms; an empty array means no rooms.
alter table public.gallery_admins add column if not exists room_ids text[];
alter table public.gallery_admins add column if not exists updated_at timestamptz not null default now();
-- Future inserts must explicitly choose a role (existing admins remain owners).
alter table public.gallery_admins alter column role set default 'editor';

create or replace function public.gallery_access()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('role',a.role,'room_ids',a.room_ids,'is_active',a.is_active)
  from public.gallery_admins a where a.user_id = (select auth.uid());
$$;
create or replace function public.gallery_has_role(roles text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.gallery_admins a
    where a.user_id = (select auth.uid()) and a.is_active and a.role = any(roles));
$$;
create or replace function public.is_gallery_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.gallery_has_role(array['owner','manager','editor']);
$$;
create or replace function public.gallery_can_room(room text, managing boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.gallery_admins a where a.user_id = (select auth.uid())
    and a.is_active and (not managing or a.role in ('owner','manager'))
    and (a.role = 'owner' or a.room_ids is null or room = any(a.room_ids)));
$$;
create or replace function public.gallery_can_slot(slot text, managing boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.gallery_slots s where s.id = slot
    and public.gallery_can_room(s.room_id,managing));
$$;
revoke all on function public.gallery_access(), public.gallery_has_role(text[]), public.gallery_can_room(text,boolean), public.gallery_can_slot(text,boolean) from public, anon;
grant execute on function public.gallery_access(), public.gallery_has_role(text[]), public.gallery_can_room(text,boolean), public.gallery_can_slot(text,boolean) to authenticated;

create or replace function public.list_gallery_accounts()
returns table(user_id uuid,email text,role text,is_active boolean,room_ids text[],updated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.gallery_has_role(array['owner']) then raise exception '최고 관리자만 계정을 관리할 수 있습니다.' using errcode='42501'; end if;
  return query select a.user_id,u.email::text,a.role,a.is_active,a.room_ids,a.updated_at
    from public.gallery_admins a join auth.users u on u.id=a.user_id order by a.created_at,a.user_id;
end;
$$;

create or replace function public.set_gallery_account(
  p_email text,p_role text,p_active boolean,p_rooms text[],p_expected timestamptz default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  target uuid;
  previous public.gallery_admins%rowtype;
  next_rooms text[];
begin
  -- All application permission changes serialize, including last-owner checks.
  lock table public.gallery_admins in exclusive mode;
  if not public.gallery_has_role(array['owner']) then raise exception '최고 관리자만 계정을 관리할 수 있습니다.' using errcode='42501'; end if;
  if p_role is null or p_role not in ('owner','manager','editor') or p_active is null then raise exception '권한 설정을 확인해 주세요.'; end if;
  select u.id into target from auth.users u where lower(u.email)=lower(btrim(p_email));
  if target is null then raise exception 'ACCOUNT_NOT_FOUND'; end if;
  if p_role='owner' then next_rooms:=null; else next_rooms:=p_rooms; end if;
  if next_rooms is not null and exists(select 1 from unnest(next_rooms) r where r is null or not exists(select 1 from public.gallery_rooms g where g.id=r)) then
    raise exception '존재하는 전시실을 선택해 주세요.';
  end if;
  select * into previous from public.gallery_admins a where a.user_id=target;
  if (previous.user_id is not null and (p_expected is null or previous.updated_at<>p_expected))
    or (previous.user_id is null and p_expected is not null) then raise exception '계정 권한이 변경되었습니다. 새로고침 후 다시 저장해 주세요.'; end if;
  if previous.role='owner' and previous.is_active and (p_role<>'owner' or not p_active)
    and not exists(select 1 from public.gallery_admins a where a.user_id<>target and a.role='owner' and a.is_active) then
    raise exception '마지막 최고 관리자는 권한을 낮추거나 접근 중지할 수 없습니다.';
  end if;
  insert into public.gallery_admins(user_id,role,is_active,room_ids,updated_at)
    values(target,p_role,p_active,next_rooms,clock_timestamp())
    on conflict(user_id) do update set role=excluded.role,is_active=excluded.is_active,room_ids=excluded.room_ids,updated_at=excluded.updated_at;
end;
$$;
revoke all on function public.list_gallery_accounts(),public.set_gallery_account(text,text,boolean,text[],timestamptz) from public,anon;
grant execute on function public.list_gallery_accounts(),public.set_gallery_account(text,text,boolean,text[],timestamptz) to authenticated;

-- Replace every broad write/read policy from the original setup.
drop policy if exists "Admins read all artworks" on public.artworks;
create policy "Admins read all artworks" on public.artworks for select to authenticated using (public.gallery_can_slot(slot_id));
drop policy if exists "Admins insert artworks" on public.artworks;
create policy "Admins insert artworks" on public.artworks for insert to authenticated with check (
  public.gallery_can_slot(slot_id) and created_by=auth.uid()
  and (not is_published or public.gallery_can_slot(slot_id,true))
);
drop policy if exists "Admins update artworks" on public.artworks;
create policy "Admins update artworks" on public.artworks for update to authenticated
  using (public.gallery_can_slot(slot_id)) with check (public.gallery_can_slot(slot_id));
drop policy if exists "Admins delete artworks" on public.artworks;
create policy "Admins delete artworks" on public.artworks for delete to authenticated using (public.gallery_can_slot(slot_id,true));

-- RLS checks row scope; a trigger also protects individual publication/location fields.
create or replace function public.guard_artwork_permissions()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not public.gallery_can_slot(old.slot_id) or not public.gallery_can_slot(new.slot_id) then
    raise exception '담당 전시실의 작품만 수정할 수 있습니다.' using errcode='42501';
  end if;
  if not public.gallery_can_slot(old.slot_id,true) and
    (new.slot_id is distinct from old.slot_id or new.is_published is distinct from old.is_published) then
    raise exception '작품 공개와 배치는 전시 관리자만 변경할 수 있습니다.' using errcode='42501';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_artwork_permissions on public.artworks;
create trigger guard_artwork_permissions before update on public.artworks for each row execute function public.guard_artwork_permissions();

drop policy if exists "Admins rename gallery rooms" on public.gallery_rooms;
create policy "Admins rename gallery rooms" on public.gallery_rooms for update to authenticated
  using (public.gallery_can_room(id,true)) with check (public.gallery_can_room(id,true));

-- Definer helper sees references in ALL rooms, regardless of the caller's SELECT scope.
create or replace function public.gallery_image_unused(path text)
returns boolean language sql stable security definer set search_path='' as $$
  select not exists(select 1 from public.artworks a where a.image_path=path);
$$;
revoke all on function public.gallery_image_unused(text) from public,anon;
grant execute on function public.gallery_image_unused(text) to authenticated;

drop policy if exists "Admins read gallery images" on storage.objects;
create policy "Admins read gallery images" on storage.objects for select to authenticated using (
  bucket_id='gallery-artworks' and (
    public.gallery_has_role(array['owner'])
    or (public.is_gallery_admin() and (storage.foldername(name))[1]=auth.uid()::text and public.gallery_image_unused(name))
    or exists(select 1 from public.artworks a where a.image_path=storage.objects.name and public.gallery_can_slot(a.slot_id))
  )
);
drop policy if exists "Admins delete unused gallery images" on storage.objects;
create policy "Admins delete unused gallery images" on storage.objects for delete to authenticated using (
  bucket_id='gallery-artworks' and public.is_gallery_admin()
  and (public.gallery_has_role(array['owner']) or (storage.foldername(name))[1]=auth.uid()::text)
  and public.gallery_image_unused(name)
);
-- Require new/replacement image paths to belong to the writer. This also prevents
-- linking another room's private image via a guessed or previously known path.
create or replace function public.guard_artwork_image()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.image_path is not null and (TG_OP='INSERT' or new.image_path is distinct from old.image_path)
    and split_part(new.image_path,'/',1) is distinct from auth.uid()::text then
    raise exception '직접 업로드한 사진만 등록할 수 있습니다.' using errcode='42501';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_artwork_image on public.artworks;
create trigger guard_artwork_image before insert or update on public.artworks for each row execute function public.guard_artwork_image();

drop policy if exists "Admins read all notes" on public.guestbook_entries;
create policy "Admins read all notes" on public.guestbook_entries for select to authenticated using (public.gallery_has_role(array['owner']));

create or replace function public.create_gallery_room(room_name text)
returns setof public.gallery_rooms
language plpgsql security definer set search_path = '' as $$
declare
  next_id text;
  clean_name text := btrim(room_name);
begin
  if not public.gallery_has_role(array['owner','manager']) or not exists(select 1 from public.gallery_admins a where a.user_id=auth.uid() and (a.role='owner' or a.room_ids is null)) then
    raise exception '운영자만 전시실을 추가할 수 있습니다.' using errcode = '42501';
  end if;
  if clean_name is null or char_length(clean_name) not between 1 and 24 or clean_name ~ '[[:cntrl:]]' then
    raise exception '전시실 이름은 줄바꿈 없이 1~24자로 입력해 주세요.';
  end if;
  -- Serialize allocation so two administrators cannot receive the same room code.
  lock table public.gallery_rooms in exclusive mode;
  select chr(n) into next_id from generate_series(68,90) n
  where not exists (select 1 from public.gallery_rooms r where r.id = chr(n))
  order by n limit 1;
  if next_id is null then
    raise exception '전시실은 최대 26개까지 추가할 수 있습니다.';
  end if;
  insert into public.gallery_rooms(id,name) values(next_id,clean_name);
  insert into public.gallery_slots(id,room_id)
  select next_id || '-' || lpad(n::text,2,'0'),next_id from generate_series(1,12) n;
  return query select r.* from public.gallery_rooms r where r.id = next_id;
end;
$$;
revoke all on function public.create_gallery_room(text) from public, anon, authenticated;
grant execute on function public.create_gallery_room(text) to authenticated;

-- Delete only empty added rooms. Slot row locks also block concurrent artwork inserts/moves.
create or replace function public.delete_gallery_room(room_id text, expected_updated_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare
  current_version timestamptz;
begin
  lock table public.gallery_admins in exclusive mode;
  if not public.gallery_can_room(room_id,true) then
    raise exception '운영자만 전시실을 삭제할 수 있습니다.' using errcode = '42501';
  end if;
  if room_id is null or room_id !~ '^[D-Z]$' then
    raise exception '기본 A·B·C 전시실은 삭제할 수 없습니다.';
  end if;
  lock table public.gallery_rooms in exclusive mode;
  select r.updated_at into current_version from public.gallery_rooms r where r.id = $1;
  if current_version is null or expected_updated_at is null or current_version <> expected_updated_at then
    raise exception '전시실이 변경되거나 삭제되었습니다. 다시 불러온 뒤 삭제해 주세요.';
  end if;
  perform 1 from public.gallery_slots s where s.room_id = $1 order by s.id for update;
  if exists (select 1 from public.artworks a join public.gallery_slots s on a.slot_id=s.id where s.room_id=$1) then
    raise exception '등록된 작품이 있는 전시실은 삭제할 수 없습니다. 비공개 작품도 다른 전시실로 이동하거나 삭제해 주세요.';
  end if;
  delete from public.gallery_slots s where s.room_id=$1;
  delete from public.gallery_rooms r where r.id=$1;
  -- A later room reusing this code must not inherit the deleted room's assignees.
  update public.gallery_admins a set room_ids=array_remove(a.room_ids,$1),updated_at=clock_timestamp()
    where $1=any(a.room_ids);
end;
$$;
revoke all on function public.delete_gallery_room(text,timestamptz) from public, anon, authenticated;
grant execute on function public.delete_gallery_room(text,timestamptz) to authenticated;

create or replace function public.moderate_guestbook(
  p_id uuid, p_action text, p_expected_visible boolean
)
returns setof public.guestbook_entries
language plpgsql security definer set search_path = '' as $$
declare
  v_entry public.guestbook_entries%rowtype;
begin
  if not public.gallery_has_role(array['owner']) then
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
