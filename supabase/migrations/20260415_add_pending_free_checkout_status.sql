-- Add an explicit backend-controlled branch for zero-amount orders.

alter table public.orders
  drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check
  check (
    status in (
      'draft',
      'pending_payment',
      'pending_free_checkout',
      'paid',
      'cancelled',
      'failed',
      'refunded'
    )
  );