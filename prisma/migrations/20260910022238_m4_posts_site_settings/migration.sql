-- CreateTable
CREATE TABLE "posts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'news',
    "section" TEXT NOT NULL DEFAULT 'general',
    "cover_palette" TEXT NOT NULL DEFAULT 'from-amber-900 via-stone-900 to-black',
    "cta_label" TEXT,
    "cta_url" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_settings" (
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "archive_headline" TEXT NOT NULL,
    "archive_description" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "posts_slug_key" ON "posts"("slug");

-- CreateIndex
CREATE INDEX "posts_section_published_created_at_idx" ON "posts"("section", "published", "created_at");

ALTER TABLE "posts"
  ADD CONSTRAINT "posts_slug_not_blank_chk" CHECK (length(btrim("slug")) > 0),
  ADD CONSTRAINT "posts_title_not_blank_chk" CHECK (length(btrim("title")) > 0),
  ADD CONSTRAINT "posts_section_chk" CHECK ("section" IN ('general', 'vst', 'beats', 'tracks', 'artists'));

ALTER TABLE "site_settings"
  ADD CONSTRAINT "site_settings_key_not_blank_chk" CHECK (length(btrim("key")) > 0);
