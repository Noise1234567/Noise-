-- NOISE-048 (DEC-018) : vérification d'identité des organisateurs.

-- AlterEnum
ALTER TYPE "AdminAction" ADD VALUE 'IDENTITY_VIEWED';
ALTER TYPE "AdminAction" ADD VALUE 'IDENTITY_APPROVED';
ALTER TYPE "AdminAction" ADD VALUE 'IDENTITY_REFUSED';

-- CreateEnum
CREATE TYPE "IdentityStatus" AS ENUM ('PENDING', 'VERIFIED', 'REFUSED');

-- AlterTable
ALTER TABLE "events" ADD COLUMN "suspended_for_identity" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "identity_verifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "IdentityStatus" NOT NULL DEFAULT 'PENDING',
    "document_public_id" VARCHAR(200),
    "document_format" VARCHAR(10),
    "document_purge_at" TIMESTAMPTZ(3),
    "submitted_at" TIMESTAMPTZ(3) NOT NULL,
    "decided_at" TIMESTAMPTZ(3),
    "decided_by_id" UUID,
    "refusal_reason" VARCHAR(500),
    "resubmit_deadline" TIMESTAMPTZ(3),
    "events_pulled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "identity_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "identity_verifications_user_id_key" ON "identity_verifications"("user_id");

-- CreateIndex
CREATE INDEX "identity_verifications_status_submitted_at_idx" ON "identity_verifications"("status", "submitted_at");

-- CreateIndex
CREATE INDEX "identity_verifications_status_resubmit_deadline_idx" ON "identity_verifications"("status", "resubmit_deadline");

-- CreateIndex
CREATE INDEX "identity_verifications_document_purge_at_idx" ON "identity_verifications"("document_purge_at");

-- AddForeignKey
ALTER TABLE "identity_verifications" ADD CONSTRAINT "identity_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_verifications" ADD CONSTRAINT "identity_verifications_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
