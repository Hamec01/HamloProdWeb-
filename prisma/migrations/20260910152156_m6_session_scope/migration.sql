-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "scope" TEXT NOT NULL DEFAULT 'admin';

ALTER TABLE "sessions"
  ADD CONSTRAINT "sessions_scope_chk" CHECK ("scope" IN ('admin', 'public'));

CREATE INDEX "sessions_scope_expires_at_idx" ON "sessions"("scope", "expires_at");
