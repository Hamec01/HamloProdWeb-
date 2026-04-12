create table if not exists public.beat_downloads (
  id uuid primary key default gen_random_uuid(),
  beat_id uuid not null references public.beats (id) on delete cascade,
  beat_title text not null,
  file_format text not null check (file_format in ('wav', 'zip')),
  user_id uuid not null references auth.users (id) on delete cascade,
  user_email text not null,
  downloaded_at timestamptz not null default now()
);

create index if not exists beat_downloads_beat_id_idx on public.beat_downloads (beat_id);
create index if not exists beat_downloads_user_id_idx on public.beat_downloads (user_id);
create index if not exists beat_downloads_downloaded_at_idx on public.beat_downloads (downloaded_at desc);

alter table public.beat_downloads enable row level security;

drop policy if exists "users insert own beat download logs" on public.beat_downloads;
create policy "users insert own beat download logs"
on public.beat_downloads
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "users read own beat download logs" on public.beat_downloads;
create policy "users read own beat download logs"
on public.beat_downloads
for select
to authenticated
using (user_id = auth.uid() or public.is_admin_user());
