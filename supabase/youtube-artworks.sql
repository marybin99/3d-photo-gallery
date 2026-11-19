-- Apply after artwork-management.sql (and the room migrations, if used).
-- Safe to re-run. Existing photos are preserved.
begin;
alter table public.artworks add column if not exists youtube_url text;
alter table public.artworks alter column image_path drop not null;
alter table public.artworks drop constraint if exists artworks_youtube_url_check;
alter table public.artworks add constraint artworks_youtube_url_check check (
  youtube_url is null or youtube_url ~ '^https://www[.]youtube[.]com/watch[?]v=[A-Za-z0-9_-]{11}$'
);
alter table public.artworks drop constraint if exists artworks_media_check;
alter table public.artworks add constraint artworks_media_check check (
  (youtube_url is null and image_path is not null)
  or (youtube_url is not null and image_path is null)
);
commit;
