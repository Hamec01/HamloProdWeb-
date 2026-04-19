alter table public.beats
add column if not exists cover_image_url text,
add column if not exists cover_image_path text;

alter table public.tracks
add column if not exists cover_image_url text,
add column if not exists cover_image_path text,
add column if not exists mp3_file_path text;

create table if not exists public.track_downloads (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.tracks (id) on delete cascade,
  track_title text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  user_email text not null,
  downloaded_at timestamptz not null default now()
);

create index if not exists track_downloads_track_id_idx on public.track_downloads (track_id);
create index if not exists track_downloads_user_id_idx on public.track_downloads (user_id);
create index if not exists track_downloads_downloaded_at_idx on public.track_downloads (downloaded_at desc);

alter table public.track_downloads enable row level security;

insert into storage.buckets (id, name, public)
values ('media-images', 'media-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('track-downloads', 'track-downloads', false)
on conflict (id) do nothing;

drop policy if exists "public can read media images" on storage.objects;
create policy "public can read media images"
on storage.objects
for select
to public
using (bucket_id = 'media-images');

drop policy if exists "admins manage media images" on storage.objects;
create policy "admins manage media images"
on storage.objects
for all
to authenticated
using (bucket_id = 'media-images' and public.is_admin_user())
with check (bucket_id = 'media-images' and public.is_admin_user());

drop policy if exists "admins manage track downloads" on storage.objects;
create policy "admins manage track downloads"
on storage.objects
for all
to authenticated
using (bucket_id = 'track-downloads' and public.is_admin_user())
with check (bucket_id = 'track-downloads' and public.is_admin_user());

drop policy if exists "authenticated users can read track downloads" on storage.objects;
create policy "authenticated users can read track downloads"
on storage.objects
for select
to authenticated
using (bucket_id = 'track-downloads');

drop policy if exists "users insert own track download logs" on public.track_downloads;
create policy "users insert own track download logs"
on public.track_downloads
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "users read own track download logs" on public.track_downloads;
create policy "users read own track download logs"
on public.track_downloads
for select
to authenticated
using (user_id = auth.uid() or public.is_admin_user());