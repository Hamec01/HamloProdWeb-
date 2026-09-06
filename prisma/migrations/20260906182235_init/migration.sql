-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'editor', 'artist');

-- CreateEnum
CREATE TYPE "BeatStatus" AS ENUM ('available', 'reserved', 'sold', 'private');

-- CreateEnum
CREATE TYPE "StorageVisibility" AS ENUM ('public', 'private');

-- CreateEnum
CREATE TYPE "UploadEntityType" AS ENUM ('beat', 'track', 'artist', 'post');

-- CreateEnum
CREATE TYPE "UploadIntentState" AS ENUM ('pending', 'attached', 'deleting', 'expired');

-- CreateEnum
CREATE TYPE "UploadKind" AS ENUM ('beat-cover', 'beat-preview', 'beat-master', 'beat-archive', 'track-cover', 'track-audio', 'artist-avatar', 'post-file');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "email_verified_at" TIMESTAMPTZ(6),
    "role" "UserRole",
    "display_name" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "ip" INET,
    "user_agent" TEXT,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beats" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "case_number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "BeatStatus" NOT NULL DEFAULT 'available',
    "bpm" INTEGER,
    "price_usd" INTEGER NOT NULL DEFAULT 0,
    "price_rub" INTEGER NOT NULL DEFAULT 0,
    "genre" TEXT,
    "substyle" TEXT,
    "mood" TEXT,
    "description" TEXT,
    "duration_seconds" INTEGER,
    "cover_key" TEXT,
    "preview_key" TEXT,
    "master_key" TEXT,
    "archive_key" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upload_intents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_id" UUID,
    "entity_type" "UploadEntityType" NOT NULL,
    "entity_id" UUID,
    "beat_id" UUID,
    "kind" "UploadKind" NOT NULL,
    "visibility" "StorageVisibility" NOT NULL,
    "key" TEXT NOT NULL,
    "content_type" TEXT,
    "size_bytes" BIGINT,
    "state" "UploadIntentState" NOT NULL DEFAULT 'pending',
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "attached_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upload_intents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "beats_slug_key" ON "beats"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "beats_case_number_key" ON "beats"("case_number");

-- CreateIndex
CREATE INDEX "beats_status_idx" ON "beats"("status");

-- CreateIndex
CREATE INDEX "beats_featured_idx" ON "beats"("featured");

-- CreateIndex
CREATE UNIQUE INDEX "upload_intents_key_key" ON "upload_intents"("key");

-- CreateIndex
CREATE INDEX "upload_intents_state_expires_at_idx" ON "upload_intents"("state", "expires_at");

-- CreateIndex
CREATE INDEX "upload_intents_entity_type_entity_id_idx" ON "upload_intents"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_intents" ADD CONSTRAINT "upload_intents_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_intents" ADD CONSTRAINT "upload_intents_beat_id_fkey" FOREIGN KEY ("beat_id") REFERENCES "beats"("id") ON DELETE CASCADE ON UPDATE CASCADE;
