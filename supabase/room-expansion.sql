-- Apply AFTER artwork-management.sql and room-names.sql. Safe to re-run.
begin;
alter table public.gallery_rooms drop constraint if exists gallery_rooms_id_check;
alter table public.gallery_rooms add constraint gallery_rooms_id_check check (id ~ '^[A-Z]$');

-- A foreign key prevents assigning artwork to a room that has not been created.
create table if not exists public.gallery_slots (
  id text primary key,
  room_id text not null references public.gallery_rooms(id),
  check (id ~ '^(0[1-9]|[12][0-9]|3[0-6]|[D-Z]-(0[1-9]|1[0-2]))$')
);
alter table public.gallery_slots enable row level security;
revoke all on public.gallery_slots from public, anon, authenticated;
grant select on public.gallery_slots to anon, authenticated;
drop policy if exists "Anyone reads gallery slots" on public.gallery_slots;
create policy "Anyone reads gallery slots" on public.gallery_slots for select to anon, authenticated using (true);
insert into public.gallery_slots(id,room_id)
select lpad(n::text,2,'0'),
  case when n between 1 and 4 or n between 13 and 20 then 'A'
       when n between 5 and 8 or n between 21 and 28 then 'B' else 'C' end
from generate_series(1,36) n on conflict (id) do nothing;
insert into public.gallery_slots(id,room_id)
select r.id || '-' || lpad(n::text,2,'0'),r.id
from public.gallery_rooms r cross join generate_series(1,12) n
where r.id ~ '^[D-Z]$' on conflict (id) do nothing;
alter table public.artworks drop constraint if exists artworks_slot_id_check;
alter table public.artworks drop constraint if exists artworks_slot_id_fkey;
alter table public.artworks add constraint artworks_slot_id_fkey foreign key (slot_id) references public.gallery_slots(id);

create or replace function public.create_gallery_room(room_name text)
returns setof public.gallery_rooms
language plpgsql security definer set search_path = '' as $$
declare
  next_id text;
  clean_name text := btrim(room_name);
begin
  if not public.is_gallery_admin() then
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
  if not public.is_gallery_admin() then
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
end;
$$;
revoke all on function public.delete_gallery_room(text,timestamptz) from public, anon, authenticated;
grant execute on function public.delete_gallery_room(text,timestamptz) to authenticated;
commit;
