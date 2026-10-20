-- AlterTable
ALTER TABLE "hpdg_license_keys" ADD COLUMN     "last_emailed_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "hpdg_stripe_checkouts" (
    "session_id" TEXT NOT NULL,
    "payment_intent_id" TEXT,
    "email" TEXT NOT NULL,
    "license_key_id" UUID,
    "created_key" BOOLEAN NOT NULL DEFAULT false,
    "emailed_at" TIMESTAMPTZ(6),
    "refunded_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hpdg_stripe_checkouts_pkey" PRIMARY KEY ("session_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hpdg_stripe_checkouts_payment_intent_id_key" ON "hpdg_stripe_checkouts"("payment_intent_id");

-- CreateIndex
CREATE INDEX "hpdg_stripe_checkouts_license_key_id_idx" ON "hpdg_stripe_checkouts"("license_key_id");

-- AddForeignKey
ALTER TABLE "hpdg_stripe_checkouts" ADD CONSTRAINT "hpdg_stripe_checkouts_license_key_id_fkey" FOREIGN KEY ("license_key_id") REFERENCES "hpdg_license_keys"("id") ON DELETE SET NULL ON UPDATE CASCADE;

