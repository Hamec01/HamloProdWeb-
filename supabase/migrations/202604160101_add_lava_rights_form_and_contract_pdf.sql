alter table public.orders
  add column if not exists market text not null default 'global',
  add column if not exists currency text not null default 'USD',
  add column if not exists provider text,
  add column if not exists paid_at timestamptz,
  add column if not exists rights_form_status text not null default 'not_started',
  add column if not exists buyer_full_name text,
  add column if not exists buyer_stage_name text,
  add column if not exists contract_pdf_path text,
  add column if not exists contract_template_type text;

alter table public.orders
  drop constraint if exists orders_rights_form_status_check;

alter table public.orders
  add constraint orders_rights_form_status_check
  check (rights_form_status in ('not_started', 'deferred', 'completed_partial'));

insert into storage.buckets (id, name, public)
values ('contracts-pdf', 'contracts-pdf', false)
on conflict (id) do nothing;

drop policy if exists "authenticated read contracts pdf" on storage.objects;
create policy "authenticated read contracts pdf"
on storage.objects
for select
to authenticated
using (bucket_id = 'contracts-pdf');

drop policy if exists "authenticated upload contracts pdf" on storage.objects;
create policy "authenticated upload contracts pdf"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'contracts-pdf');

drop policy if exists "admins manage contracts pdf" on storage.objects;
create policy "admins manage contracts pdf"
on storage.objects
for all
to authenticated
using (bucket_id = 'contracts-pdf' and public.is_admin_user())
with check (bucket_id = 'contracts-pdf' and public.is_admin_user());
