-- Apply AFTER room-expansion.sql. Safe for existing projects and re-runs.
begin;
-- Existing rooms stay open. Rooms created after this migration start closed.
alter table public.gallery_rooms add column if not exists is_open boolean not null default true;
alter table public.gallery_rooms alter column is_open set default false;
grant update (is_open) on public.gallery_rooms to authenticated;
-- The existing admin-only UPDATE policy and version-stamping trigger also cover is_open.

-- Visitors can read published artworks only in open rooms. Admin policies remain intact.
drop policy if exists "Read published artworks" on public.artworks;
create policy "Read published artworks" on public.artworks
  for select to anon, authenticated using (
    is_published and exists (
      select 1 from public.gallery_slots s
      join public.gallery_rooms r on r.id = s.room_id
      where s.id = artworks.slot_id and r.is_open
    )
  );
drop policy if exists "Read published gallery images" on storage.objects;
create policy "Read published gallery images" on storage.objects
  for select to anon, authenticated using (
    bucket_id = 'gallery-artworks' and exists (
      select 1 from public.artworks a
      join public.gallery_slots s on s.id = a.slot_id
      join public.gallery_rooms r on r.id = s.room_id
      where a.image_path = storage.objects.name and a.is_published and r.is_open
    )
  );
commit;
