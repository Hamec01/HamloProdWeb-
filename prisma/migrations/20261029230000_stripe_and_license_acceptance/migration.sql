ALTER TABLE "orders"
  ADD COLUMN "terms_accepted_at" TIMESTAMPTZ(6),
  ADD COLUMN "personal_data_consent_at" TIMESTAMPTZ(6);

ALTER TABLE "orders"
  ALTER COLUMN "provider" SET DEFAULT 'stripe',
  ALTER COLUMN "license_type" SET DEFAULT 'exclusive',
  DROP CONSTRAINT "orders_provider_chk",
  ADD CONSTRAINT "orders_provider_chk"
    CHECK ("provider" IN ('paypal', 'lava', 'stripe', 'contact', 'internal'));

CREATE FUNCTION "prevent_sold_beat_reactivation"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."status" = 'sold' AND NEW."status" <> 'sold' THEN
    RAISE EXCEPTION 'A sold beat cannot be reactivated.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "beats_prevent_sold_reactivation"
BEFORE UPDATE OF "status" ON "beats"
FOR EACH ROW
EXECUTE FUNCTION "prevent_sold_beat_reactivation"();
