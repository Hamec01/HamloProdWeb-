SET lock_timeout = '5s';
SET statement_timeout = '30s';

ALTER TABLE "orders" ADD COLUMN "admin_archived_at" TIMESTAMPTZ(6);

CREATE INDEX "orders_provider_status_admin_archived_at_created_at_idx"
ON "orders"("provider", "status", "admin_archived_at", "created_at");
