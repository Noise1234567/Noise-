-- NOISE-037 (DEC-020) : suspension d'un événement par un administrateur et journal des actions
-- d'administration.

-- AlterEnum
ALTER TYPE "EventStatus" ADD VALUE 'SUSPENDED';

-- CreateEnum
CREATE TYPE "AdminAction" AS ENUM ('USER_SUSPENDED', 'USER_REACTIVATED', 'EVENT_SUSPENDED', 'EVENT_REACTIVATED', 'SALES_EXPORTED');

-- CreateEnum
CREATE TYPE "AdminTargetType" AS ENUM ('USER', 'EVENT');

-- AlterTable
ALTER TABLE "events" ADD COLUMN "suspended_with_organizer" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" UUID NOT NULL,
    "admin_id" UUID NOT NULL,
    "action" "AdminAction" NOT NULL,
    "target_type" "AdminTargetType" NOT NULL,
    "target_id" UUID NOT NULL,
    "reason" VARCHAR(500),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_audit_logs_target_type_target_id_idx" ON "admin_audit_logs"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "admin_audit_logs_admin_id_created_at_idx" ON "admin_audit_logs"("admin_id", "created_at");

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
