-- ─────────────────────────────────────────────────────────────────────────────
-- Releases (альбомы / EP / mixtape)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.releases (
  id              uuid        primary key default gen_random_uuid(),
  title           text        not null,
  slug            text        not null unique,
  artist_name     text        not null default 'HaM',
  release_type    text        not null check (release_type in ('album', 'ep', 'mixtape')),
  cover_palette   text        not null default 'from-zinc-900 via-stone-900 to-black',
  cover_image_url text,
  cover_image_path text,
  description     text        not null default '',
  spotify_url     text        not null default '',
  apple_music_url text        not null default '',
  youtube_url     text        not null default '',
  release_date    text        not null,
  published       boolean     not null default true,
  featured        boolean     not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists releases_type_published_idx
  on public.releases (release_type, published, created_at desc);

alter table public.releases enable row level security;

drop trigger if exists releases_set_updated_at on public.releases;
create trigger releases_set_updated_at
  before update on public.releases
  for each row execute function public.set_updated_at();

drop policy if exists "public can read published releases" on public.releases;
create policy "public can read published releases"
  on public.releases for select to public
  using (published = true);

drop policy if exists "admins manage releases" on public.releases;
create policy "admins manage releases"
  on public.releases for all to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

-- ─────────────────────────────────────────────────────────────────────────────
-- Update tracks table: link tracks to releases
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.tracks
  add column if not exists release_id    uuid references public.releases(id) on delete set null,
  add column if not exists track_number  int;

create index if not exists tracks_release_id_idx
  on public.tracks (release_id, track_number asc);
