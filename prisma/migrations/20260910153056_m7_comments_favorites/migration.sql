-- CreateTable
CREATE TABLE "comments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entity" TEXT NOT NULL,
    "content_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "display_name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "stars" SMALLINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "user_id" UUID NOT NULL,
    "track_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("user_id","track_id")
);

-- CreateIndex
CREATE INDEX "comments_entity_content_id_created_at_idx" ON "comments"("entity", "content_id", "created_at");

-- CreateIndex
CREATE INDEX "comments_author_id_idx" ON "comments"("author_id");

-- CreateIndex
CREATE INDEX "favorites_user_id_idx" ON "favorites"("user_id");

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "comments"
  ADD CONSTRAINT "comments_entity_chk" CHECK ("entity" IN ('release', 'artist_post', 'beat', 'track')),
  ADD CONSTRAINT "comments_body_chk" CHECK (char_length(btrim("body")) >= 1 AND char_length("body") <= 1000),
  ADD CONSTRAINT "comments_display_name_chk" CHECK (char_length(btrim("display_name")) >= 1 AND char_length("display_name") <= 60),
  ADD CONSTRAINT "comments_stars_chk" CHECK ("stars" IS NULL OR ("stars" >= 1 AND "stars" <= 5));
