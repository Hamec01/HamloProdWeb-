alter table public.beats
  alter column preview_url drop not null;

update public.beats
set preview_url = null
where preview_url is not null
  and btrim(preview_url) = '';

alter table public.beats
  add column if not exists preview_file_name text,
  add column if not exists preview_mime_type text,
  add column if not exists preview_size_bytes bigint;

alter table public.beats
  drop constraint if exists beats_preview_size_bytes_check;

alter table public.beats
  add constraint beats_preview_size_bytes_check check (preview_size_bytes is null or preview_size_bytes >= 0);

insert into storage.buckets (id, name, public)
values ('beat-previews', 'beat-previews', true)
on conflict (id) do nothing;