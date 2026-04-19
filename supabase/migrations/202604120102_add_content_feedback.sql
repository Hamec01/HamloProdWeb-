create table if not exists public.content_ratings (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('beat', 'track')),
  content_id uuid not null,
  user_id uuid not null,
  user_email text not null,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (content_type, content_id, user_id)
);

create table if not exists public.content_comments (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('beat', 'track')),
  content_id uuid not null,
  user_id uuid not null,
  user_email text not null,
  comment text not null check (char_length(comment) between 2 and 500),
  created_at timestamptz not null default now()
);

create index if not exists idx_content_ratings_content on public.content_ratings(content_type, content_id);
create index if not exists idx_content_comments_content on public.content_comments(content_type, content_id, created_at desc);

drop trigger if exists trg_content_ratings_set_updated_at on public.content_ratings;
create trigger trg_content_ratings_set_updated_at
before update on public.content_ratings
for each row
execute function public.set_updated_at();

alter table public.content_ratings enable row level security;
alter table public.content_comments enable row level security;

drop policy if exists "content_ratings_select" on public.content_ratings;
create policy "content_ratings_select"
on public.content_ratings
for select
using (true);

drop policy if exists "content_ratings_insert_own" on public.content_ratings;
create policy "content_ratings_insert_own"
on public.content_ratings
for insert
with check (auth.uid() = user_id);

drop policy if exists "content_ratings_update_own" on public.content_ratings;
create policy "content_ratings_update_own"
on public.content_ratings
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "content_comments_select" on public.content_comments;
create policy "content_comments_select"
on public.content_comments
for select
using (true);

drop policy if exists "content_comments_insert_own" on public.content_comments;
create policy "content_comments_insert_own"
on public.content_comments
for insert
with check (auth.uid() = user_id);

drop policy if exists "content_comments_delete_own" on public.content_comments;
create policy "content_comments_delete_own"
on public.content_comments
for delete
using (auth.uid() = user_id);