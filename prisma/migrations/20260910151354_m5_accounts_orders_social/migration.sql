-- AlterTable
ALTER TABLE "users" ADD COLUMN     "last_sign_in_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "beat_id" UUID NOT NULL,
    "buyer_user_id" UUID,
    "buyer_email" TEXT NOT NULL,
    "buyer_name" TEXT,
    "buyer_country" TEXT,
    "buyer_city" TEXT,
    "buyer_phone" TEXT,
    "buyer_full_name" TEXT,
    "buyer_stage_name" TEXT,
    "base_price_usd" INTEGER NOT NULL,
    "final_price_usd" INTEGER NOT NULL,
    "base_price" INTEGER NOT NULL DEFAULT 0,
    "final_price" INTEGER NOT NULL DEFAULT 0,
    "discount_percent" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "market" TEXT NOT NULL DEFAULT 'global',
    "provider" TEXT NOT NULL DEFAULT 'paypal',
    "payment_provider" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "license_type" TEXT NOT NULL DEFAULT 'basic',
    "contract_language" TEXT NOT NULL DEFAULT 'ru',
    "rights_form_status" TEXT NOT NULL DEFAULT 'not_started',
    "contract_template_type" TEXT,
    "contract_pdf_key" TEXT,
    "payment_external_id" TEXT,
    "payment_url" TEXT,
    "download_token" TEXT,
    "expires_at" TIMESTAMPTZ(6),
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "beat_id" UUID NOT NULL,
    "buyer_email" TEXT NOT NULL,
    "html_snapshot" TEXT NOT NULL,
    "pdf_key" TEXT,
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beat_purchases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "beat_id" UUID NOT NULL,
    "beat_title" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "user_email" TEXT NOT NULL,
    "base_price_usd" INTEGER NOT NULL,
    "discount_percent" INTEGER NOT NULL,
    "final_price_usd" INTEGER NOT NULL,
    "points_earned" INTEGER NOT NULL DEFAULT 1,
    "order_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beat_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beat_reactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "beat_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "user_email" TEXT NOT NULL,
    "reaction" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beat_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_comments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "content_type" TEXT NOT NULL,
    "content_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "user_email" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_ratings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "content_type" TEXT NOT NULL,
    "content_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "user_email" TEXT NOT NULL,
    "rating" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_loyalty_points" (
    "user_id" UUID NOT NULL,
    "user_email" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_loyalty_points_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "beat_downloads" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "beat_id" UUID NOT NULL,
    "beat_title" TEXT NOT NULL,
    "file_format" TEXT NOT NULL DEFAULT 'mp3',
    "user_id" UUID NOT NULL,
    "user_email" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beat_downloads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "track_downloads" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "track_id" UUID NOT NULL,
    "track_title" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "user_email" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "track_downloads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "orders_download_token_key" ON "orders"("download_token");

-- CreateIndex
CREATE INDEX "orders_beat_id_idx" ON "orders"("beat_id");

-- CreateIndex
CREATE INDEX "orders_buyer_user_id_idx" ON "orders"("buyer_user_id");

-- CreateIndex
CREATE INDEX "orders_status_created_at_idx" ON "orders"("status", "created_at");

-- CreateIndex
CREATE INDEX "orders_payment_external_id_idx" ON "orders"("payment_external_id");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_order_id_key" ON "contracts"("order_id");

-- CreateIndex
CREATE INDEX "contracts_beat_id_idx" ON "contracts"("beat_id");

-- CreateIndex
CREATE INDEX "contracts_buyer_email_idx" ON "contracts"("buyer_email");

-- CreateIndex
CREATE INDEX "beat_purchases_user_id_created_at_idx" ON "beat_purchases"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "beat_purchases_order_id_idx" ON "beat_purchases"("order_id");

-- CreateIndex
CREATE INDEX "beat_reactions_beat_id_idx" ON "beat_reactions"("beat_id");

-- CreateIndex
CREATE UNIQUE INDEX "beat_reactions_beat_id_user_id_key" ON "beat_reactions"("beat_id", "user_id");

-- CreateIndex
CREATE INDEX "content_comments_content_type_content_id_created_at_idx" ON "content_comments"("content_type", "content_id", "created_at");

-- CreateIndex
CREATE INDEX "content_comments_user_id_idx" ON "content_comments"("user_id");

-- CreateIndex
CREATE INDEX "content_ratings_content_type_content_id_idx" ON "content_ratings"("content_type", "content_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_ratings_content_type_content_id_user_id_key" ON "content_ratings"("content_type", "content_id", "user_id");

-- CreateIndex
CREATE INDEX "beat_downloads_created_at_idx" ON "beat_downloads"("created_at");

-- CreateIndex
CREATE INDEX "track_downloads_created_at_idx" ON "track_downloads"("created_at");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_beat_id_fkey" FOREIGN KEY ("beat_id") REFERENCES "beats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_buyer_user_id_fkey" FOREIGN KEY ("buyer_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_beat_id_fkey" FOREIGN KEY ("beat_id") REFERENCES "beats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beat_purchases" ADD CONSTRAINT "beat_purchases_beat_id_fkey" FOREIGN KEY ("beat_id") REFERENCES "beats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beat_purchases" ADD CONSTRAINT "beat_purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beat_reactions" ADD CONSTRAINT "beat_reactions_beat_id_fkey" FOREIGN KEY ("beat_id") REFERENCES "beats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beat_reactions" ADD CONSTRAINT "beat_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_comments" ADD CONSTRAINT "content_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_ratings" ADD CONSTRAINT "content_ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_loyalty_points" ADD CONSTRAINT "user_loyalty_points_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CHECK constraints — mirror the legacy Supabase schema so the database, not the
-- application, is the source of truth for these invariants.
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_buyer_email_chk" CHECK (char_length("buyer_email") > 0),
  ADD CONSTRAINT "orders_base_price_usd_chk" CHECK ("base_price_usd" >= 0),
  ADD CONSTRAINT "orders_final_price_usd_chk" CHECK ("final_price_usd" >= 0),
  ADD CONSTRAINT "orders_base_price_chk" CHECK ("base_price" >= 0),
  ADD CONSTRAINT "orders_final_price_chk" CHECK ("final_price" >= 0),
  ADD CONSTRAINT "orders_discount_percent_chk" CHECK ("discount_percent" >= 0 AND "discount_percent" <= 100),
  ADD CONSTRAINT "orders_status_chk" CHECK ("status" IN ('draft', 'pending_payment', 'pending_free_checkout', 'paid', 'cancelled', 'failed', 'refunded')),
  ADD CONSTRAINT "orders_currency_chk" CHECK ("currency" IN ('USD', 'RUB')),
  ADD CONSTRAINT "orders_market_chk" CHECK ("market" IN ('global', 'ru')),
  ADD CONSTRAINT "orders_provider_chk" CHECK ("provider" IN ('paypal', 'lava', 'internal')),
  ADD CONSTRAINT "orders_license_type_chk" CHECK ("license_type" IN ('basic', 'exclusive')),
  ADD CONSTRAINT "orders_contract_language_chk" CHECK ("contract_language" IN ('ru', 'en')),
  ADD CONSTRAINT "orders_rights_form_status_chk" CHECK ("rights_form_status" IN ('not_started', 'deferred', 'completed_partial'));

ALTER TABLE "contracts"
  ADD CONSTRAINT "contracts_buyer_email_chk" CHECK (char_length("buyer_email") > 0);

ALTER TABLE "beat_purchases"
  ADD CONSTRAINT "beat_purchases_base_price_usd_chk" CHECK ("base_price_usd" >= 0),
  ADD CONSTRAINT "beat_purchases_final_price_usd_chk" CHECK ("final_price_usd" >= 0),
  ADD CONSTRAINT "beat_purchases_discount_percent_chk" CHECK ("discount_percent" IN (0, 50, 100)),
  ADD CONSTRAINT "beat_purchases_points_earned_chk" CHECK ("points_earned" >= 0);

ALTER TABLE "beat_reactions"
  ADD CONSTRAINT "beat_reactions_reaction_chk" CHECK ("reaction" IN ('like', 'dislike'));

ALTER TABLE "content_comments"
  ADD CONSTRAINT "content_comments_content_type_chk" CHECK ("content_type" IN ('beat', 'track')),
  ADD CONSTRAINT "content_comments_comment_chk" CHECK (char_length("comment") >= 2 AND char_length("comment") <= 500);

ALTER TABLE "content_ratings"
  ADD CONSTRAINT "content_ratings_content_type_chk" CHECK ("content_type" IN ('beat', 'track')),
  ADD CONSTRAINT "content_ratings_rating_chk" CHECK ("rating" >= 1 AND "rating" <= 5);

ALTER TABLE "user_loyalty_points"
  ADD CONSTRAINT "user_loyalty_points_points_chk" CHECK ("points" >= 0);

ALTER TABLE "beat_downloads"
  ADD CONSTRAINT "beat_downloads_file_format_chk" CHECK ("file_format" IN ('mp3', 'wav', 'zip'));
