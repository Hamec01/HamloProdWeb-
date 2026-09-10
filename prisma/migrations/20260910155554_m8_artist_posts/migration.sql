-- CreateTable
CREATE TABLE "artist_posts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "artist_id" UUID NOT NULL,
    "author_id" UUID,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "image_key" TEXT,
    "audio_key" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artist_posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "artist_posts_artist_id_published_created_at_idx" ON "artist_posts"("artist_id", "published", "created_at");

-- AddForeignKey
ALTER TABLE "artist_posts" ADD CONSTRAINT "artist_posts_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "artists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
