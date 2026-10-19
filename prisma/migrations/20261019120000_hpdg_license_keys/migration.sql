-- CreateTable
CREATE TABLE "hpdg_releases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "page" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'windows-x64',
    "object_key" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hpdg_releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hpdg_license_keys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'beta',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "note" TEXT,
    "stripe_customer_id" TEXT,
    "stripe_session_id" TEXT,
    "stripe_payment_id" TEXT,
    "revoked_at" TIMESTAMPTZ(6),
    "revoked_reason" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hpdg_license_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hpdg_downloads" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "license_key_id" UUID NOT NULL,
    "version" TEXT NOT NULL,
    "current_version" TEXT,
    "ip_country" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hpdg_downloads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hpdg_releases_version_key" ON "hpdg_releases"("version");

-- CreateIndex
CREATE UNIQUE INDEX "hpdg_license_keys_key_key" ON "hpdg_license_keys"("key");

-- CreateIndex
CREATE UNIQUE INDEX "hpdg_license_keys_key_hash_key" ON "hpdg_license_keys"("key_hash");

-- CreateIndex
CREATE UNIQUE INDEX "hpdg_license_keys_stripe_session_id_key" ON "hpdg_license_keys"("stripe_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "hpdg_license_keys_stripe_payment_id_key" ON "hpdg_license_keys"("stripe_payment_id");

-- CreateIndex
CREATE INDEX "hpdg_license_keys_email_idx" ON "hpdg_license_keys"("email");

-- CreateIndex
CREATE INDEX "hpdg_downloads_license_key_id_created_at_idx" ON "hpdg_downloads"("license_key_id", "created_at");

-- AddForeignKey
ALTER TABLE "hpdg_downloads" ADD CONSTRAINT "hpdg_downloads_license_key_id_fkey" FOREIGN KEY ("license_key_id") REFERENCES "hpdg_license_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Hand-written (Prisma Migrate does not manage these; invisible to drift detection).
-- At most one current release.
CREATE UNIQUE INDEX "hpdg_releases_one_current_idx" ON "hpdg_releases" ("is_current") WHERE "is_current";

ALTER TABLE "hpdg_releases"
  ADD CONSTRAINT "hpdg_releases_version_chk" CHECK ("version" ~ '^[0-9]+\.[0-9]+\.[0-9]+(-[a-z]+\.[0-9]+)?$'),
  ADD CONSTRAINT "hpdg_releases_sha256_chk" CHECK ("sha256" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "hpdg_releases_size_chk" CHECK ("size" > 0),
  ADD CONSTRAINT "hpdg_releases_object_key_chk" CHECK ("object_key" ~ '^hpdg/[A-Za-z0-9][A-Za-z0-9._-]*$'),
  ADD CONSTRAINT "hpdg_releases_page_chk" CHECK ("page" ~ '^https://(www\.)?hamloprod\.org(/|$)');

ALTER TABLE "hpdg_license_keys"
  ADD CONSTRAINT "hpdg_license_keys_key_chk" CHECK ("key" ~ '^HPDG(-[0-9A-HJKMNP-TV-Z]{4}){4}$'),
  ADD CONSTRAINT "hpdg_license_keys_email_chk" CHECK (position('@' in "email") > 1);
