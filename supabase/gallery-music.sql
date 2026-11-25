-- Apply after account-permissions.sql. Re-run to migrate existing music settings.
begin;

create or replace function public.valid_gallery_audio_tracks(tracks jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
begin
  if jsonb_typeof(tracks) is distinct from 'array' then return false; end if;
  return not exists (
    select 1 from jsonb_array_elements(tracks) as items(track)
    where not coalesce(
      jsonb_typeof(track) = 'object'
      and jsonb_typeof(track->'path') = 'string'
      and track->>'path' ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(mp3|m4a|wav|ogg)$'
      and jsonb_typeof(track->'title') = 'string'
      and char_length(btrim(track->>'title')) between 1 and 160,
      false
    )
  ) and jsonb_array_length(tracks) = (
    select count(distinct track->>'path') from jsonb_array_elements(tracks) as items(track)
  );
end;
$$;

create table if not exists public.gallery_music (
  id boolean primary key default true check (id),
  youtube_id text check (youtube_id ~ '^[A-Za-z0-9_-]{11}$' and length(youtube_id) = 11),
  version uuid not null default gen_random_uuid()
);
alter table public.gallery_music add column if not exists audio_tracks jsonb not null default '[]';
alter table public.gallery_music drop constraint if exists gallery_music_audio_tracks_check;
alter table public.gallery_music add constraint gallery_music_audio_tracks_check
  check (public.valid_gallery_audio_tracks(audio_tracks));

drop policy if exists "Delete unused gallery music files" on storage.objects;
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'gallery_music' and column_name = 'audio_path'
  ) then
    update public.gallery_music
    set audio_tracks = jsonb_build_array(jsonb_build_object('path', audio_path, 'title', '기존 배경음악'))
    where audio_path is not null and audio_tracks = '[]';
    alter table public.gallery_music drop column audio_path;
  end if;
end;
$$;
insert into public.gallery_music (id) values (true) on conflict (id) do nothing;

alter table public.gallery_music enable row level security;
revoke all on public.gallery_music from public, anon, authenticated;
grant select on public.gallery_music to anon, authenticated;
grant update (youtube_id, audio_tracks) on public.gallery_music to authenticated;

drop policy if exists "Read gallery music" on public.gallery_music;
create policy "Read gallery music" on public.gallery_music for select to anon, authenticated using (true);
drop policy if exists "Manage gallery music" on public.gallery_music;
create policy "Manage gallery music" on public.gallery_music for update to authenticated
  using ((select public.gallery_can_room('LOBBY', true)))
  with check ((select public.gallery_can_room('LOBBY', true)));

create or replace function public.stamp_gallery_music_version()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.version := gen_random_uuid();
  return new;
end;
$$;
drop trigger if exists stamp_gallery_music_version on public.gallery_music;
create trigger stamp_gallery_music_version before update on public.gallery_music
  for each row execute function public.stamp_gallery_music_version();

-- This dedicated bucket serves visitor-facing music through stable playback URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gallery-music', 'gallery-music', true, 20971520,
        array['audio/mpeg','audio/mp4','audio/wav','audio/ogg'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "List gallery music files" on storage.objects;
create policy "List gallery music files" on storage.objects for select to authenticated
  using (bucket_id = 'gallery-music' and (select public.gallery_can_room('LOBBY', true)));
drop policy if exists "Upload gallery music files" on storage.objects;
create policy "Upload gallery music files" on storage.objects for insert to authenticated
  with check (bucket_id = 'gallery-music' and (select public.gallery_can_room('LOBBY', true))
    and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Delete unused gallery music files" on storage.objects for delete to authenticated
  using (bucket_id = 'gallery-music' and (select public.gallery_can_room('LOBBY', true))
    and not exists (
      select 1 from public.gallery_music
      where audio_tracks @> jsonb_build_array(jsonb_build_object('path', storage.objects.name))
    ));

commit;
