create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique not null,
  role text not null check (role in ('admin', 'editor')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  key text primary key,
  title text not null,
  subtitle text not null,
  archive_headline text not null,
  archive_description text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.beats (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  case_number text not null unique,
  cover_palette text not null,
  preview_url text not null,
  bpm integer not null,
  mood text not null,
  description text not null,
  price_usd integer not null default 0,
  status text not null check (status in ('available', 'reserved', 'sold', 'private')) default 'available',
  featured boolean not null default false,
  duration text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  artist_name text not null,
  cover_palette text not null,
  spotify_url text not null,
  apple_music_url text not null,
  youtube_url text not null,
  release_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.artists (
  id uuid primary key default gen_random_uuid(),
  artist_name text not null,
  track_title text not null,
  beat_title text not null,
  cover_palette text not null,
  spotify_url text not null,
  apple_music_url text not null,
  youtube_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists site_settings_set_updated_at on public.site_settings;
create trigger site_settings_set_updated_at
before update on public.site_settings
for each row
execute function public.set_updated_at();

drop trigger if exists beats_set_updated_at on public.beats;
create trigger beats_set_updated_at
before update on public.beats
for each row
execute function public.set_updated_at();

drop trigger if exists tracks_set_updated_at on public.tracks;
create trigger tracks_set_updated_at
before update on public.tracks
for each row
execute function public.set_updated_at();

drop trigger if exists artists_set_updated_at on public.artists;
create trigger artists_set_updated_at
before update on public.artists
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.site_settings enable row level security;
alter table public.beats enable row level security;
alter table public.tracks enable row level security;
alter table public.artists enable row level security;

create or replace function public.is_admin_user()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('admin', 'editor')
  );
$$;

drop policy if exists "public can read visible beats" on public.beats;
create policy "public can read visible beats"
on public.beats
for select
to public
using (status <> 'private');

drop policy if exists "admins manage beats" on public.beats;
create policy "admins manage beats"
on public.beats
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "public can read tracks" on public.tracks;
create policy "public can read tracks"
on public.tracks
for select
to public
using (true);

drop policy if exists "admins manage tracks" on public.tracks;
create policy "admins manage tracks"
on public.tracks
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "public can read artists" on public.artists;
create policy "public can read artists"
on public.artists
for select
to public
using (true);

drop policy if exists "admins manage artists" on public.artists;
create policy "admins manage artists"
on public.artists
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "admins manage site settings" on public.site_settings;
create policy "admins manage site settings"
on public.site_settings
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "public can read site settings" on public.site_settings;
create policy "public can read site settings"
on public.site_settings
for select
to public
using (true);

drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile"
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_admin_user());

drop policy if exists "admins manage profiles" on public.profiles;
create policy "admins manage profiles"
on public.profiles
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

insert into public.site_settings (key, title, subtitle, archive_headline, archive_description)
values (
  'primary',
  'HamloProd',
  'Ты ещё вернёшься',
  'Archive Case Files',
  'Select a beat from the archives. Final content will come from Supabase, not from page code.'
)
on conflict (key) do nothing;