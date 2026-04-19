-- ============================================================
-- Purchase flow: orders + contracts + beat_purchases extension
-- beats already exists (20260408_init_hamloprod.sql)
-- beat_purchases already exists (20260413_add_user_loyalty_points.sql)
-- ============================================================

-- ----------------------------------------------------------
-- orders
-- ----------------------------------------------------------
create table if not exists public.orders (
  id                   uuid        primary key default gen_random_uuid(),
  beat_id              uuid        not null references public.beats(id) on delete restrict,
  buyer_user_id        uuid        references auth.users(id) on delete set null,
  buyer_email          text        not null check (char_length(buyer_email) > 0),
  base_price_usd       integer     not null check (base_price_usd >= 0),
  discount_percent     integer     not null default 0
                                   check (discount_percent >= 0 and discount_percent <= 100),
  final_price_usd      integer     not null check (final_price_usd >= 0),
  status               text        not null default 'draft'
                                   check (status in (
                                     'draft',
                                     'pending_payment',
                                     'paid',
                                     'cancelled',
                                     'failed',
                                     'refunded'
                                   )),
  payment_provider     text,
  payment_external_id  text,
  download_token       text        unique,
  expires_at           timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_orders_beat_id
  on public.orders(beat_id);

create index if not exists idx_orders_buyer_user_id
  on public.orders(buyer_user_id);

create index if not exists idx_orders_buyer_email
  on public.orders(buyer_email);

create index if not exists idx_orders_payment_external_id
  on public.orders(payment_external_id)
  where payment_external_id is not null;

create index if not exists idx_orders_download_token
  on public.orders(download_token)
  where download_token is not null;

create index if not exists idx_orders_status_created
  on public.orders(status, created_at desc);

drop trigger if exists trg_orders_set_updated_at on public.orders;
create trigger trg_orders_set_updated_at
before update on public.orders
for each row
execute function public.set_updated_at();

-- ----------------------------------------------------------
-- contracts
-- ----------------------------------------------------------
create table if not exists public.contracts (
  id             uuid        primary key default gen_random_uuid(),
  order_id       uuid        not null unique references public.orders(id) on delete cascade,
  beat_id        uuid        not null references public.beats(id) on delete restrict,
  buyer_email    text        not null check (char_length(buyer_email) > 0),
  html_snapshot  text        not null,
  pdf_path       text,
  issued_at      timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

create index if not exists idx_contracts_order_id
  on public.contracts(order_id);

create index if not exists idx_contracts_beat_id
  on public.contracts(beat_id);

create index if not exists idx_contracts_buyer_email
  on public.contracts(buyer_email);

-- ----------------------------------------------------------
-- extend beat_purchases: soft-link to orders (nullable →
-- existing rows remain valid, new purchases reference order)
-- ----------------------------------------------------------
alter table public.beat_purchases
  add column if not exists order_id uuid
    references public.orders(id) on delete set null;

create index if not exists idx_beat_purchases_order_id
  on public.beat_purchases(order_id)
  where order_id is not null;

-- ----------------------------------------------------------
-- RLS
-- ----------------------------------------------------------
alter table public.orders   enable row level security;
alter table public.contracts enable row level security;

-- orders: owner or admin
drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own"
  on public.orders for select
  using (
    auth.uid() = buyer_user_id
    or public.is_admin_user()
  );

drop policy if exists "orders_insert_own" on public.orders;
create policy "orders_insert_own"
  on public.orders for insert
  with check (auth.uid() = buyer_user_id);

drop policy if exists "orders_update_own" on public.orders;
create policy "orders_update_own"
  on public.orders for update
  using (auth.uid() = buyer_user_id or public.is_admin_user())
  with check (auth.uid() = buyer_user_id or public.is_admin_user());

drop policy if exists "orders_admin_all" on public.orders;
create policy "orders_admin_all"
  on public.orders for all
  using (public.is_admin_user());

-- contracts: owner (by email match on verified session) or admin
drop policy if exists "contracts_select_own" on public.contracts;
create policy "contracts_select_own"
  on public.contracts for select
  using (
    buyer_email = (
      select email from auth.users where id = auth.uid()
    )
    or public.is_admin_user()
  );

drop policy if exists "contracts_insert_service" on public.contracts;
create policy "contracts_insert_service"
  on public.contracts for insert
  with check (public.is_admin_user());

drop policy if exists "contracts_admin_all" on public.contracts;
create policy "contracts_admin_all"
  on public.contracts for all
  using (public.is_admin_user());
