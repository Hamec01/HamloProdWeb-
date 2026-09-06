-- CreateTable
CREATE TABLE "auth_throttle" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "window_started_at" TIMESTAMPTZ(6) NOT NULL,
    "blocked_until" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_throttle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_throttle_key_hash_key" ON "auth_throttle"("key_hash");

-- CreateIndex
CREATE INDEX "auth_throttle_blocked_until_idx" ON "auth_throttle"("blocked_until");
