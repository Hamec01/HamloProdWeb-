-- CreateEnum
CREATE TYPE "ReleaseType" AS ENUM ('album', 'ep', 'mixtape');

-- CreateTable
CREATE TABLE "artists" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "artist_name" TEXT NOT NULL,
    "track_title" TEXT NOT NULL DEFAULT '',
    "beat_title" TEXT NOT NULL DEFAULT '',
    "bio" TEXT NOT NULL DEFAULT '',
    "photo_key" TEXT,
    "cover_palette" TEXT NOT NULL DEFAULT 'from-zinc-900 via-stone-900 to-black',
    "spotify_url" TEXT NOT NULL DEFAULT '',
    "apple_music_url" TEXT NOT NULL DEFAULT '',
    "youtube_url" TEXT NOT NULL DEFAULT '',
    "vk_url" TEXT NOT NULL DEFAULT '',
    "telegram_url" TEXT NOT NULL DEFAULT '',
    "yandex_music_url" TEXT NOT NULL DEFAULT '',
    "tidal_url" TEXT NOT NULL DEFAULT '',
    "soundcloud_url" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "releases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "artist_name" TEXT NOT NULL DEFAULT 'HaM',
    "feat_artist_names" TEXT NOT NULL DEFAULT '',
    "release_type" "ReleaseType" NOT NULL,
    "cover_palette" TEXT NOT NULL DEFAULT 'from-zinc-900 via-stone-900 to-black',
    "cover_key" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "spotify_url" TEXT NOT NULL DEFAULT '',
    "apple_music_url" TEXT NOT NULL DEFAULT '',
    "youtube_url" TEXT NOT NULL DEFAULT '',
    "release_date" DATE NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "artist_name" TEXT NOT NULL,
    "cover_palette" TEXT NOT NULL DEFAULT 'from-zinc-900 via-stone-900 to-black',
    "cover_key" TEXT,
    "audio_key" TEXT,
    "spotify_url" TEXT NOT NULL DEFAULT '',
    "apple_music_url" TEXT NOT NULL DEFAULT '',
    "youtube_url" TEXT NOT NULL DEFAULT '',
    "release_date" DATE NOT NULL,
    "release_id" UUID,
    "track_number" INTEGER,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "artists_slug_key" ON "artists"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "releases_slug_key" ON "releases"("slug");

-- CreateIndex
CREATE INDEX "releases_release_type_published_created_at_idx" ON "releases"("release_type", "published", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "tracks_slug_key" ON "tracks"("slug");

-- CreateIndex
CREATE INDEX "tracks_release_id_track_number_idx" ON "tracks"("release_id", "track_number");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "artists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "releases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Value-level integrity not represented by Prisma's schema language.
ALTER TABLE "artists"
  ADD CONSTRAINT "artists_slug_not_blank_chk" CHECK (length(btrim("slug")) > 0),
  ADD CONSTRAINT "artists_name_not_blank_chk" CHECK (length(btrim("artist_name")) > 0);

ALTER TABLE "releases"
  ADD CONSTRAINT "releases_slug_not_blank_chk" CHECK (length(btrim("slug")) > 0),
  ADD CONSTRAINT "releases_title_not_blank_chk" CHECK (length(btrim("title")) > 0);

ALTER TABLE "tracks"
  ADD CONSTRAINT "tracks_slug_not_blank_chk" CHECK (length(btrim("slug")) > 0),
  ADD CONSTRAINT "tracks_title_not_blank_chk" CHECK (length(btrim("title")) > 0),
  ADD CONSTRAINT "tracks_number_positive_chk" CHECK ("track_number" IS NULL OR "track_number" > 0);
