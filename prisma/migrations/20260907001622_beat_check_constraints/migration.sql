-- M2 — value-level integrity for beats. Prisma Migrate does not manage CHECK
-- constraints, so they are added here by hand and are invisible to drift
-- detection.

ALTER TABLE "beats"
  ADD CONSTRAINT "beats_price_usd_nonneg_chk" CHECK ("price_usd" >= 0),
  ADD CONSTRAINT "beats_price_rub_nonneg_chk" CHECK ("price_rub" >= 0),
  ADD CONSTRAINT "beats_bpm_range_chk" CHECK ("bpm" IS NULL OR ("bpm" BETWEEN 40 AND 300)),
  ADD CONSTRAINT "beats_duration_nonneg_chk" CHECK ("duration_seconds" IS NULL OR "duration_seconds" >= 0),
  ADD CONSTRAINT "beats_preview_size_nonneg_chk" CHECK ("preview_size_bytes" IS NULL OR "preview_size_bytes" >= 0),
  ADD CONSTRAINT "beats_slug_not_blank_chk" CHECK (length(btrim("slug")) > 0),
  ADD CONSTRAINT "beats_case_number_not_blank_chk" CHECK (length(btrim("case_number")) > 0),
  ADD CONSTRAINT "beats_title_not_blank_chk" CHECK (length(btrim("title")) > 0);
