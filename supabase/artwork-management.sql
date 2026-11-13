-- Run in the Supabase SQL Editor as the project owner. Safe to re-run.
begin;

create table if not exists public.gallery_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.gallery_admins enable row level security;
revoke all on public.gallery_admins from public, anon, authenticated;

create or replace function public.is_gallery_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists(select 1 from public.gallery_admins where user_id = (select auth.uid()));
$$;
revoke all on function public.is_gallery_admin() from public, anon;
grant execute on function public.is_gallery_admin() to authenticated;

create table if not exists public.artworks (
  id uuid primary key default gen_random_uuid(),
  slot_id text not null unique check (slot_id ~ '^(0[1-9]|[12][0-9]|3[0-6])$'),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  image_path text not null unique check (
    image_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg|png)$'
  ),
  is_published boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.artworks enable row level security;
revoke all on public.artworks from public, anon, authenticated;
grant select on public.artworks to anon, authenticated;
grant insert, update, delete on public.artworks to authenticated;

drop policy if exists "Read published artworks" on public.artworks;
create policy "Read published artworks" on public.artworks
  for select to anon, authenticated using (is_published);
drop policy if exists "Admins read all artworks" on public.artworks;
create policy "Admins read all artworks" on public.artworks
  for select to authenticated using ((select public.is_gallery_admin()));
drop policy if exists "Admins insert artworks" on public.artworks;
create policy "Admins insert artworks" on public.artworks
  for insert to authenticated with check (
    (select public.is_gallery_admin()) and created_by = (select auth.uid())
  );
drop policy if exists "Admins update artworks" on public.artworks;
create policy "Admins update artworks" on public.artworks
  for update to authenticated
  using ((select public.is_gallery_admin()))
  with check ((select public.is_gallery_admin()));
drop policy if exists "Admins delete artworks" on public.artworks;
create policy "Admins delete artworks" on public.artworks
  for delete to authenticated using ((select public.is_gallery_admin()));

create or replace function public.stamp_artwork_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.id := old.id;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists stamp_artwork_update on public.artworks;
create trigger stamp_artwork_update before update on public.artworks
  for each row execute function public.stamp_artwork_update();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gallery-artworks', 'gallery-artworks', false, 10485760,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Read published gallery images" on storage.objects;
create policy "Read published gallery images" on storage.objects
  for select to anon, authenticated using (
    bucket_id = 'gallery-artworks' and exists (
      select 1 from public.artworks a where a.image_path = name and a.is_published
    )
  );
drop policy if exists "Admins read gallery images" on storage.objects;
create policy "Admins read gallery images" on storage.objects
  for select to authenticated using (
    bucket_id = 'gallery-artworks' and (select public.is_gallery_admin())
  );
drop policy if exists "Admins upload gallery images" on storage.objects;
create policy "Admins upload gallery images" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'gallery-artworks' and (select public.is_gallery_admin())
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
-- Images are immutable: replacements get a fresh path, never an overwrite.
drop policy if exists "Admins delete unused gallery images" on storage.objects;
create policy "Admins delete unused gallery images" on storage.objects
  for delete to authenticated using (
    bucket_id = 'gallery-artworks' and (select public.is_gallery_admin())
    and not exists (select 1 from public.artworks a where a.image_path = name)
  );

commit;

-- Bootstrap only through SQL Editor, AFTER creating an Auth user:
-- insert into public.gallery_admins (user_id)
-- select id from auth.users where email = 'YOUR_ADMIN_EMAIL'
-- on conflict (user_id) do nothing;
-- No frontend signup or self-service admin grants are provided.
