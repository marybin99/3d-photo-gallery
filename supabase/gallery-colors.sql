-- Apply after the room expansion, opening, and account permissions scripts.
begin;

alter table public.gallery_rooms
  add column if not exists entrance_color text not null default '#ac9477'
  check (length(entrance_color) = 7 and entrance_color ~ '^#[0-9a-fA-F]{6}$');

alter table public.gallery_rooms
  add column if not exists sign_text_color text not null default '#fff6e7'
  check (length(sign_text_color) = 7 and sign_text_color ~ '^#[0-9a-fA-F]{6}$');

alter table public.artworks
  add column if not exists frame_color text not null default '#806d59'
  check (length(frame_color) = 7 and frame_color ~ '^#[0-9a-fA-F]{6}$');

grant update (entrance_color, sign_text_color) on public.gallery_rooms to authenticated;

-- Reuse the existing creation permissions and slot allocation in the same transaction.
create or replace function public.create_gallery_room(
  room_name text, room_entrance_color text, room_sign_text_color text
)
returns setof public.gallery_rooms
language plpgsql security invoker set search_path = '' as $$
declare
  created_id text;
begin
  if room_entrance_color is null or length(room_entrance_color) <> 7
    or room_entrance_color !~ '^#[0-9a-fA-F]{6}$'
    or room_sign_text_color is null or length(room_sign_text_color) <> 7
    or room_sign_text_color !~ '^#[0-9a-fA-F]{6}$' then
    raise exception '색상은 #RRGGBB 형식으로 입력해 주세요.';
  end if;

  select room.id into strict created_id
  from public.create_gallery_room(room_name) as room;

  return query
    update public.gallery_rooms as room
    set entrance_color = lower(room_entrance_color),
        sign_text_color = lower(room_sign_text_color)
    where room.id = created_id
    returning room.*;

  if not found then
    raise exception '전시실 색상을 저장하지 못했습니다.' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.create_gallery_room(room_name text, room_entrance_color text)
returns setof public.gallery_rooms
language sql security invoker set search_path = '' as $$
  select * from public.create_gallery_room(room_name, room_entrance_color, '#fff6e7');
$$;

revoke all on function public.create_gallery_room(text,text,text) from public, anon, authenticated;
grant execute on function public.create_gallery_room(text,text,text) to authenticated;
revoke all on function public.create_gallery_room(text,text) from public, anon, authenticated;
grant execute on function public.create_gallery_room(text,text) to authenticated;

commit;
