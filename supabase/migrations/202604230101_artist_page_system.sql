-- =============================================================================
-- Artist Page System
-- Extends artists table, links releases, adds artist_posts and comments
-- =============================================================================

-- ── 1. Extend artists table ───────────────────────────────────────────────────
alter table public.artists
  add column if not exists slug          text,
  add column if not exists bio           text        not null default '',
  add column if not exists photo_url     text,
  add column if not exists photo_path    text,
  add column if not exists vk_url        text        not null default '',
  add column if not exists telegram_url  text        not null default '',
  add column if not exists yandex_music_url text     not null default '',
  add column if not exists tidal_url     text        not null default '',
  add column if not exists soundcloud_url text       not null default '';

-- Auto-generate slug from artist_name for existing rows (latin chars only)
update public.artists
  set slug = lower(regexp_replace(
    regexp_replace(artist_name, '[^a-zA-Z0-9\s\-]', '', 'g'),
    '\s+', '-', 'g'))
  where slug is null or slug = '';

-- Slug must be NOT NULL and unique
alter table public.artists alter column slug set not null;
create unique index if not exists artists_slug_idx on public.artists (slug);

-- ── 2. Add artist_id FK to releases ──────────────────────────────────────────
alter table public.releases
  add column if not exists artist_id uuid references public.artists(id) on delete set null;

create index if not exists releases_artist_id_idx on public.releases (artist_id);

-- ── 3. Extend profiles: add 'artist' role + artist_id link ───────────────────
alter table public.profiles
  drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'editor', 'artist'));
alter table public.profiles
  add column if not exists artist_id uuid references public.artists(id) on delete set null;

-- ── 4. Artist posts (news) ────────────────────────────────────────────────────
create table if not exists public.artist_posts (
  id          uuid        primary key default gen_random_uuid(),
  artist_id   uuid        not null references public.artists(id) on delete cascade,
  author_id   uuid        references auth.users(id) on delete set null,
  title       text        not null,
  body        text        not null default '',
  image_url   text,
  image_path  text,
  audio_url   text,
  audio_path  text,
  published   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists artist_posts_artist_id_idx
  on public.artist_posts (artist_id, created_at desc);

drop trigger if exists artist_posts_set_updated_at on public.artist_posts;
create trigger artist_posts_set_updated_at
  before update on public.artist_posts
  for each row execute function public.set_updated_at();

alter table public.artist_posts enable row level security;

drop policy if exists "public can read published artist posts" on public.artist_posts;
create policy "public can read published artist posts"
  on public.artist_posts for select to public
  using (published = true);

drop policy if exists "artists and admins manage artist posts" on public.artist_posts;
create policy "artists and admins manage artist posts"
  on public.artist_posts for all to authenticated
  using (
    public.is_admin_user() or
    (select artist_id from public.profiles where id = auth.uid()) = artist_id
  )
  with check (
    public.is_admin_user() or
    (select artist_id from public.profiles where id = auth.uid()) = artist_id
  );

-- ── 5. Comments (generic: release, artist_post) ───────────────────────────────
create table if not exists public.comments (
  id           uuid       primary key default gen_random_uuid(),
  entity       text       not null check (entity in ('release', 'artist_post', 'beat', 'track')),
  content_id   uuid       not null,
  author_id    uuid       not null references auth.users(id) on delete cascade,
  display_name text       not null default 'Слушатель',
  body         text       not null,
  stars        smallint   check (stars between 1 and 5),
  created_at   timestamptz not null default now()
);

create index if not exists comments_entity_content_idx
  on public.comments (entity, content_id, created_at desc);

alter table public.comments enable row level security;

drop policy if exists "public can read comments" on public.comments;
create policy "public can read comments"
  on public.comments for select to public
  using (true);

drop policy if exists "authenticated users can create comments" on public.comments;
create policy "authenticated users can create comments"
  on public.comments for insert to authenticated
  with check (author_id = auth.uid());

drop policy if exists "users delete own comments" on public.comments;
create policy "users delete own comments"
  on public.comments for delete to authenticated
  using (author_id = auth.uid() or public.is_admin_user());
