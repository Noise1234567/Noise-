-- AlterEnum
ALTER TYPE "AdminAction" ADD VALUE 'REFUND_MARKED';

-- AlterEnum
ALTER TYPE "AdminTargetType" ADD VALUE 'ORDER';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "refund_reference" VARCHAR(100),
ADD COLUMN     "refunded_at" TIMESTAMPTZ(3),
ADD COLUMN     "refunded_by_id" UUID;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_refunded_by_id_fkey" FOREIGN KEY ("refunded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
