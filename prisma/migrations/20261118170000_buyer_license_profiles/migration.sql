SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE TABLE "buyer_license_profiles" (
  "user_id" UUID NOT NULL PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "full_name" TEXT NOT NULL,
  "stage_name" TEXT NOT NULL DEFAULT '',
  "email" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "phone" TEXT NOT NULL DEFAULT '',
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
