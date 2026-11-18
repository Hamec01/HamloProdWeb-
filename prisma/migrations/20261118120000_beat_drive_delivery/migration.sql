-- CreateTable
CREATE TABLE "beat_deliveries" (
    "beat_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beat_deliveries_pkey" PRIMARY KEY ("beat_id")
);

-- AddForeignKey
ALTER TABLE "beat_deliveries" ADD CONSTRAINT "beat_deliveries_beat_id_fkey" FOREIGN KEY ("beat_id") REFERENCES "beats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

