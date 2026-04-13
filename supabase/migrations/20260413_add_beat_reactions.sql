create table if not exists public.beat_reactions (
  id uuid primary key default gen_random_uuid(),
  beat_id uuid not null references public.beats(id) on delete cascade,
  user_id uuid not null,
  user_email text not null,
  reaction text not null check (reaction in ('like', 'dislike')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (beat_id, user_id)
);

create index if not exists idx_beat_reactions_beat on public.beat_reactions(beat_id);

drop trigger if exists trg_beat_reactions_set_updated_at on public.beat_reactions;
create trigger trg_beat_reactions_set_updated_at
before update on public.beat_reactions
for each row
execute function public.set_updated_at();

alter table public.beat_reactions enable row level security;

drop policy if exists "beat_reactions_select" on public.beat_reactions;
create policy "beat_reactions_select"
on public.beat_reactions
for select
using (true);

drop policy if exists "beat_reactions_insert_own" on public.beat_reactions;
create policy "beat_reactions_insert_own"
on public.beat_reactions
for insert
with check (auth.uid() = user_id);

drop policy if exists "beat_reactions_update_own" on public.beat_reactions;
create policy "beat_reactions_update_own"
on public.beat_reactions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
