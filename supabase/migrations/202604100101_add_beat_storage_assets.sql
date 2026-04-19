alter table public.beats
add column if not exists preview_storage_path text,
add column if not exists wav_file_path text,
add column if not exists zip_file_path text;

insert into storage.buckets (id, name, public)
values ('beat-previews', 'beat-previews', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('beat-downloads', 'beat-downloads', false)
on conflict (id) do nothing;

drop policy if exists "public can read beat previews" on storage.objects;
create policy "public can read beat previews"
on storage.objects
for select
to public
using (bucket_id = 'beat-previews');

drop policy if exists "admins manage beat previews" on storage.objects;
create policy "admins manage beat previews"
on storage.objects
for all
to authenticated
using (bucket_id = 'beat-previews' and public.is_admin_user())
with check (bucket_id = 'beat-previews' and public.is_admin_user());

drop policy if exists "admins manage beat downloads" on storage.objects;
create policy "admins manage beat downloads"
on storage.objects
for all
to authenticated
using (bucket_id = 'beat-downloads' and public.is_admin_user())
with check (bucket_id = 'beat-downloads' and public.is_admin_user());