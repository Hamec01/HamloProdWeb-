alter table public.orders
  add column if not exists base_price integer,
  add column if not exists final_price integer;

update public.orders
set
  base_price = coalesce(base_price, base_price_usd, 0),
  final_price = coalesce(final_price, final_price_usd, 0),
  currency = coalesce(nullif(currency, ''), 'USD'),
  market = coalesce(nullif(market, ''), case when coalesce(currency, 'USD') = 'RUB' then 'ru' else 'global' end),
  provider = coalesce(nullif(provider, ''), nullif(payment_provider, ''), case when coalesce(currency, 'USD') = 'RUB' then 'lava' else 'paypal' end);

alter table public.orders
  alter column base_price set default 0,
  alter column final_price set default 0,
  alter column currency set default 'USD',
  alter column market set default 'global',
  alter column provider set default 'paypal';

update public.orders
set
  base_price = 0
where base_price is null;

update public.orders
set
  final_price = 0
where final_price is null;

update public.orders
set currency = 'USD'
where currency is null or currency = '';

update public.orders
set market = case when currency = 'RUB' then 'ru' else 'global' end
where market is null or market = '';

update public.orders
set provider = case when currency = 'RUB' then 'lava' else 'paypal' end
where provider is null or provider = '';

alter table public.orders
  alter column base_price set not null,
  alter column final_price set not null,
  alter column currency set not null,
  alter column market set not null,
  alter column provider set not null;

alter table public.orders
  drop constraint if exists orders_currency_check;

alter table public.orders
  add constraint orders_currency_check
  check (currency in ('USD', 'RUB'));

alter table public.orders
  drop constraint if exists orders_market_check;

alter table public.orders
  add constraint orders_market_check
  check (market in ('global', 'ru'));

alter table public.orders
  drop constraint if exists orders_provider_check;

alter table public.orders
  add constraint orders_provider_check
  check (provider in ('paypal', 'lava', 'internal'));
