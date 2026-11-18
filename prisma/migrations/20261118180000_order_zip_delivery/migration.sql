SET lock_timeout = '5s';
SET statement_timeout = '30s';
ALTER TABLE "orders" ADD COLUMN "delivery_archive_key" TEXT;
CREATE INDEX "orders_delivery_archive_key_idx" ON "orders"("delivery_archive_key");
