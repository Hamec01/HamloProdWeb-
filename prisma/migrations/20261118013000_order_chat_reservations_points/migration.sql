ALTER TABLE "orders"
  ADD COLUMN "buyer_last_read_at" TIMESTAMPTZ(6),
  ADD COLUMN "admin_last_read_at" TIMESTAMPTZ(6),
  ADD COLUMN "loyalty_points_spent" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT "orders_points_spent_chk" CHECK (loyalty_points_spent IN (0, 100));

ALTER TABLE "beats"
  ADD COLUMN "reservation_order_id" UUID REFERENCES "orders"("id") ON DELETE SET NULL,
  ADD COLUMN "reservation_buyer_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  ADD COLUMN "reservation_expires_at" TIMESTAMPTZ(6);
CREATE INDEX "beats_reservation_expiry_idx" ON "beats"("reservation_expires_at") WHERE "reservation_expires_at" IS NOT NULL;

CREATE TABLE "order_messages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "order_id" UUID NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "author_user_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "author_role" TEXT NOT NULL CHECK ("author_role" IN ('buyer','admin','system')),
  "text" TEXT NOT NULL CHECK (length(btrim("text")) BETWEEN 1 AND 4000),
  "client_message_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "order_messages_order_id_author_user_id_client_message_id_key" ON "order_messages"("order_id", "author_user_id", "client_message_id");
CREATE INDEX "order_messages_order_id_created_at_id_idx" ON "order_messages"("order_id", "created_at", "id");

-- Preserve balances and history when changing from one point to 25 per purchase.
UPDATE "user_loyalty_points" SET points = points * 25;
UPDATE "beat_purchases" SET points_earned = points_earned * 25;
