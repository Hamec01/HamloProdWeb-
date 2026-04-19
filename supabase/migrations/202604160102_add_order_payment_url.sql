alter table public.orders
  add column if not exists payment_url text;

create index if not exists idx_orders_payment_url
  on public.orders(payment_url)
  where payment_url is not null;
