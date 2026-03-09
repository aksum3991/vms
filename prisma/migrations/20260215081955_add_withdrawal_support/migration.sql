-- AlterEnum
ALTER TYPE "Status" ADD VALUE 'withdrawn';

-- AlterTable
ALTER TABLE "requests" ADD COLUMN     "withdrawalReason" TEXT,
ADD COLUMN     "withdrawnAt" TIMESTAMP(3),
ADD COLUMN     "withdrawnById" TEXT;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_withdrawnById_fkey" FOREIGN KEY ("withdrawnById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
