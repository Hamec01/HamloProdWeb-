ALTER TABLE "orders" ADD COLUMN "loyalty_awarded_at" TIMESTAMPTZ(6);

-- Repair legacy confirmed exclusive orders that predate the sale integration.
UPDATE "beats" b SET "status" = 'sold', "available_for_download" = false
WHERE b.status IN ('available', 'reserved') AND EXISTS (
  SELECT 1 FROM "orders" o WHERE o.beat_id = b.id
  AND o.license_type = 'exclusive' AND o.status IN ('paid', 'pending_free_checkout')
);

UPDATE "beats" SET "available_for_download" = false WHERE "status" = 'sold' AND "available_for_download";

-- Extend the existing permanent-sale guard to normalize download availability.
CREATE OR REPLACE FUNCTION "prevent_sold_beat_reactivation"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = 'sold' AND NEW.status <> 'sold' THEN
    RAISE EXCEPTION 'A sold beat cannot be reactivated.' USING ERRCODE = '23514';
  END IF;
  IF NEW.status = 'sold' THEN
    NEW.available_for_download := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER "beats_prevent_sold_reactivation" ON "beats";
CREATE TRIGGER "beats_prevent_sold_reactivation" BEFORE INSERT OR UPDATE ON "beats"
FOR EACH ROW EXECUTE FUNCTION "prevent_sold_beat_reactivation"();
