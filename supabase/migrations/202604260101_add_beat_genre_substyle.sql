alter table public.beats
  add column if not exists genre text,
  add column if not exists substyle text;

update public.beats
set genre = case
  when lower(mood) like '%boom bap%' or lower(mood) like '%boombap%' or lower(mood) like '%bap%' then 'boombap'
  when lower(mood) like '%drill%' then 'drill'
  when lower(mood) like '%trap%' then 'trap'
  when lower(mood) like '%rap%' then 'rap'
  else 'another'
end
where genre is null;

update public.beats
set substyle = case
  when genre = 'boombap' then 'Classic'
  when genre = 'rap' then 'Classic'
  when genre = 'trap' then 'Dark'
  when genre = 'drill' then 'Dark'
  else 'Hybrid'
end
where substyle is null;

alter table public.beats
  alter column genre set default 'another',
  alter column genre set not null,
  alter column substyle set default 'Hybrid',
  alter column substyle set not null;

alter table public.beats
  drop constraint if exists beats_genre_check;

alter table public.beats
  add constraint beats_genre_check check (genre in ('boombap', 'rap', 'trap', 'drill', 'another'));

create index if not exists beats_genre_idx on public.beats (genre);
