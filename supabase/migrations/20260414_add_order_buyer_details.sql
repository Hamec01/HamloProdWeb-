-- Add buyer personal details + license options to orders
-- (created blank by 20260414_add_purchase_flow.sql)

alter table public.orders
  add column if not exists buyer_name      text,
  add column if not exists buyer_country   text,
  add column if not exists buyer_city      text,
  add column if not exists buyer_passport  text,
  add column if not exists buyer_phone     text,
  add column if not exists license_type    text not null default 'basic'
    check (license_type in ('basic', 'exclusive')),
  add column if not exists contract_language text not null default 'ru'
    check (contract_language in ('ru', 'en'));
