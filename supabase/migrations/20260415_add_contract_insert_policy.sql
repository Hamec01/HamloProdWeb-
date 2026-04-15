-- Allow authenticated users to insert contracts for their own orders.
-- The previous "contracts_insert_service" policy only allowed is_admin_user().
-- Now we also permit the order owner (buyer_user_id = auth.uid()) to insert.

drop policy if exists "contracts_insert_service" on public.contracts;

create policy "contracts_insert_own_order"
  on public.contracts for insert
  with check (
    public.is_admin_user()
    or exists (
      select 1
      from public.orders
      where orders.id = contracts.order_id
        and orders.buyer_user_id = auth.uid()
    )
  );
