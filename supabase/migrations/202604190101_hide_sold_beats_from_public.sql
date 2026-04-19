update public.beats
set status = 'sold'
where status <> 'sold'
  and exists (
    select 1
    from public.orders
    where orders.beat_id = beats.id
      and orders.status = 'paid'
  );

drop policy if exists "public can read visible beats" on public.beats;
create policy "public can read visible beats"
on public.beats
for select
to public
using (status in ('available', 'reserved'));
