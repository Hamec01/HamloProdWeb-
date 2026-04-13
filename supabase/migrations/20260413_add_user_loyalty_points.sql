create table if not exists public.user_loyalty_points (
  user_id uuid primary key,
  user_email text not null,
  points integer not null default 0 check (points >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.beat_purchases (
  id uuid primary key default gen_random_uuid(),
  beat_id uuid not null references public.beats(id) on delete cascade,
  beat_title text not null,
  user_id uuid not null,
  user_email text not null,
  base_price_usd integer not null check (base_price_usd >= 0),
  discount_percent integer not null check (discount_percent in (0, 50, 100)),
  final_price_usd integer not null check (final_price_usd >= 0),
  points_earned integer not null default 1 check (points_earned >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_beat_purchases_user_created on public.beat_purchases(user_id, created_at desc);

drop trigger if exists trg_user_loyalty_points_set_updated_at on public.user_loyalty_points;
create trigger trg_user_loyalty_points_set_updated_at
before update on public.user_loyalty_points
for each row
execute function public.set_updated_at();

alter table public.user_loyalty_points enable row level security;
alter table public.beat_purchases enable row level security;

drop policy if exists "user_loyalty_points_select_own" on public.user_loyalty_points;
create policy "user_loyalty_points_select_own"
on public.user_loyalty_points
for select
using (auth.uid() = user_id);

drop policy if exists "user_loyalty_points_insert_own" on public.user_loyalty_points;
create policy "user_loyalty_points_insert_own"
on public.user_loyalty_points
for insert
with check (auth.uid() = user_id);

drop policy if exists "user_loyalty_points_update_own" on public.user_loyalty_points;
create policy "user_loyalty_points_update_own"
on public.user_loyalty_points
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "beat_purchases_select_own" on public.beat_purchases;
create policy "beat_purchases_select_own"
on public.beat_purchases
for select
using (auth.uid() = user_id);

drop policy if exists "beat_purchases_insert_own" on public.beat_purchases;
create policy "beat_purchases_insert_own"
on public.beat_purchases
for insert
with check (auth.uid() = user_id);
