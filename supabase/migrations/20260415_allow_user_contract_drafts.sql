-- Allow authenticated buyers to create/update/read their own contract drafts
-- based on the order ownership, while preserving admin access.

alter table public.contracts enable row level security;

drop policy if exists "contracts_select_own" on public.contracts;
create policy "contracts_select_own"
  on public.contracts for select
  using (
    exists (
      select 1
      from public.orders
      where orders.id = contracts.order_id
        and orders.buyer_user_id = auth.uid()
    )
    or public.is_admin_user()
  );

drop policy if exists "contracts_insert_service" on public.contracts;
drop policy if exists "contracts_insert_own" on public.contracts;
create policy "contracts_insert_own"
  on public.contracts for insert
  with check (
    exists (
      select 1
      from public.orders
      where orders.id = contracts.order_id
        and orders.buyer_user_id = auth.uid()
    )
    or public.is_admin_user()
  );

drop policy if exists "contracts_update_own" on public.contracts;
create policy "contracts_update_own"
  on public.contracts for update
  using (
    exists (
      select 1
      from public.orders
      where orders.id = contracts.order_id
        and orders.buyer_user_id = auth.uid()
    )
    or public.is_admin_user()
  )
  with check (
    exists (
      select 1
      from public.orders
      where orders.id = contracts.order_id
        and orders.buyer_user_id = auth.uid()
    )
    or public.is_admin_user()
  );

drop policy if exists "contracts_admin_all" on public.contracts;
create policy "contracts_admin_all"
  on public.contracts for all
  using (public.is_admin_user())
  with check (public.is_admin_user());
