-- Allow authenticated buyers to manage their own contracts.
-- Previously only admins could insert; now the buyer who owns the
-- linked order may also insert and update their contract.

-- ── insert: buyer owns the related order ────────────────────────────────────
drop policy if exists "contracts_insert_service" on public.contracts;
drop policy if exists "contracts_insert_own" on public.contracts;

create policy "contracts_insert_own"
  on public.contracts for insert
  with check (
    exists (
      select 1
      from public.orders
      where id = order_id
        and buyer_user_id = auth.uid()
    )
    or public.is_admin_user()
  );

-- ── update: buyer owns the related order (for snapshot re-generation) ────────
drop policy if exists "contracts_update_own" on public.contracts;

create policy "contracts_update_own"
  on public.contracts for update
  using (
    exists (
      select 1
      from public.orders
      where id = order_id
        and buyer_user_id = auth.uid()
    )
    or public.is_admin_user()
  )
  with check (
    exists (
      select 1
      from public.orders
      where id = order_id
        and buyer_user_id = auth.uid()
    )
    or public.is_admin_user()
  );
