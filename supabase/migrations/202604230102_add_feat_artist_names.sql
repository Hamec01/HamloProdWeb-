-- Add feat_artist_names to releases
-- Stores comma-separated names of featured/co-artists (e.g. "ТриатлON, DJ Name")
-- The getArtistReleases query matches on this field via ILIKE so a co-artist's
-- page automatically shows the release as soon as their artist profile is created.

ALTER TABLE releases
  ADD COLUMN IF NOT EXISTS feat_artist_names TEXT NOT NULL DEFAULT '';
