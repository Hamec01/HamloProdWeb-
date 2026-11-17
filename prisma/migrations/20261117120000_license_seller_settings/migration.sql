CREATE TABLE "license_seller_settings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "identity" JSONB NOT NULL,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "license_seller_settings_pkey" PRIMARY KEY ("id")
);
