alter table public.beats
  add column if not exists price_rub integer not null default 2500 check (price_rub >= 0);

update public.beats
set price_rub = case
  when price_rub is null or price_rub = 0 then greatest(price_usd * 25, 2500)
  else price_rub
end;
