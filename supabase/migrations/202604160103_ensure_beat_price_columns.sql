alter table public.beats
  add column if not exists price_usd integer,
  add column if not exists price_rub integer;

update public.beats
set
  price_usd = case
    when price_usd is null or price_usd < 0 then greatest(coalesce(price_rub / 25, 100), 0)
    else price_usd
  end,
  price_rub = case
    when price_rub is null or price_rub <= 0 then greatest(coalesce(price_usd, 100) * 25, 2500)
    else price_rub
  end;

alter table public.beats
  alter column price_usd set default 100,
  alter column price_usd set not null,
  alter column price_rub set default 2500,
  alter column price_rub set not null;
