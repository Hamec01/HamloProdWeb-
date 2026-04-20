create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text not null,
  content text not null,
  category text not null default 'news',
  section text not null check (section in ('general', 'vst', 'beats', 'tracks', 'artists')) default 'general',
  cover_palette text not null default 'from-amber-900 via-stone-900 to-black',
  cta_label text,
  cta_url text,
  published boolean not null default true,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists posts_section_published_idx on public.posts (section, published, created_at desc);

alter table public.posts enable row level security;

drop trigger if exists posts_set_updated_at on public.posts;
create trigger posts_set_updated_at
before update on public.posts
for each row
execute function public.set_updated_at();

drop policy if exists "public can read published posts" on public.posts;
create policy "public can read published posts"
on public.posts
for select
to public
using (published = true);

drop policy if exists "admins manage posts" on public.posts;
create policy "admins manage posts"
on public.posts
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

insert into public.posts (title, slug, excerpt, content, category, section, cover_palette, cta_label, cta_url, published, featured)
values (
  'Drum Generator VST3 — первый анонс',
  'drum-generator-vst3-first-look',
  'Новый VST3-сектор открыт. Здесь будут новости, обновления, демо и документация по инструменту.',
  'Мы открываем отдельную витрину для Drum Generator VST3.\n\nТеперь новости и материалы по инструменту можно публиковать прямо из админки, без ручного редактирования страниц.\n\nПиши посты на русском — английская версия для EN-режима будет формироваться автоматически.',
  'news',
  'vst',
  'from-amber-900 via-stone-900 to-black',
  'Скоро демо',
  null,
  true,
  true
)
on conflict (slug) do nothing;
