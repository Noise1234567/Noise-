-- Annulation d'un événement (NOISE-029). Prisma propose aussi de supprimer "events_styles_idx"
-- (index GIN créé en SQL par NOISE-014, absent du schéma) : ligne retirée volontairement.

-- CreateTable
CREATE TABLE "event_cancellations" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "cancelled_by_id" UUID NOT NULL,
    "reason" VARCHAR(500),
    "tickets_cancelled" INTEGER NOT NULL,
    "sales_xof" INTEGER NOT NULL,
    "cancellation_fee_xof" INTEGER NOT NULL,
    "paid_out_xof" INTEGER NOT NULL,
    "return_due_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_cancellations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_cancellations_event_id_key" ON "event_cancellations"("event_id");

-- CreateIndex
CREATE INDEX "event_cancellations_return_due_at_idx" ON "event_cancellations"("return_due_at");

-- AddForeignKey
ALTER TABLE "event_cancellations" ADD CONSTRAINT "event_cancellations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_cancellations" ADD CONSTRAINT "event_cancellations_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
