CREATE TABLE "hpdg_update_campaigns" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "release_id" UUID NOT NULL REFERENCES "hpdg_releases"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "version" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "created_by_id" UUID NOT NULL,
  "test_email" TEXT,
  "test_message_id" TEXT,
  "test_confirmed_at" TIMESTAMPTZ(6),
  "test_confirmed_by_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hpdg_update_campaigns_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "hpdg_update_campaigns_release_id_key" ON "hpdg_update_campaigns"("release_id");
CREATE UNIQUE INDEX "hpdg_update_campaigns_version_key" ON "hpdg_update_campaigns"("version");
CREATE TABLE "hpdg_update_recipients" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "campaign_id" UUID NOT NULL REFERENCES "hpdg_update_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "license_key_id" UUID NOT NULL REFERENCES "hpdg_license_keys"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "email" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "message_id" TEXT,
  "error" TEXT,
  "attempted_at" TIMESTAMPTZ(6),
  "accepted_at" TIMESTAMPTZ(6),
  CONSTRAINT "hpdg_update_recipients_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hpdg_update_recipients_status_check" CHECK ("status" IN ('pending','sending','accepted','delivered','rejected','failed','unknown','skipped','bounced','complained','suppressed','canceled'))
);
CREATE UNIQUE INDEX "hpdg_update_recipients_campaign_id_email_key" ON "hpdg_update_recipients"("campaign_id", "email");
CREATE INDEX "hpdg_update_recipients_campaign_id_status_idx" ON "hpdg_update_recipients"("campaign_id", "status");
