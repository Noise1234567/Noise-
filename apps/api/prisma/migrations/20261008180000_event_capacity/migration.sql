-- Capacité déclarée et frais d'organisation (NOISE-044, DEC-023).
ALTER TABLE "events"
  ADD COLUMN "capacity" INTEGER,
  ADD COLUMN "fee_paid_xof" INTEGER NOT NULL DEFAULT 0;

-- Événements existants : la capacité reprend la somme de leurs billets (au moins 1).
UPDATE "events" e
SET "capacity" = GREATEST(1, COALESCE((SELECT SUM(t."quantity_total") FROM "ticket_types" t WHERE t."event_id" = e."id"), 0));

ALTER TABLE "events"
  ALTER COLUMN "capacity" SET NOT NULL,
  ADD CONSTRAINT "events_capacity_positive" CHECK ("capacity" > 0),
  ADD CONSTRAINT "events_fee_paid_not_negative" CHECK ("fee_paid_xof" >= 0);
