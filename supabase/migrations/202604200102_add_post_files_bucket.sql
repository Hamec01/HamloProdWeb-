insert into storage.buckets (id, name, public)
values ('post-files', 'post-files', true)
on conflict (id) do nothing;

drop policy if exists "public can read post files" on storage.objects;
create policy "public can read post files"
on storage.objects
for select
to public
using (bucket_id = 'post-files');

drop policy if exists "admins manage post files" on storage.objects;
create policy "admins manage post files"
on storage.objects
for all
to authenticated
using (bucket_id = 'post-files' and public.is_admin_user())
with check (bucket_id = 'post-files' and public.is_admin_user());
