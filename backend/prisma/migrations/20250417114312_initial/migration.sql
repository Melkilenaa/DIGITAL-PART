-- CreateEnum
CREATE TYPE "PayoutUserType" AS ENUM ('VENDOR', 'DRIVER');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'APPROVED', 'PROCESSED', 'REJECTED');

-- AlterTable
ALTER TABLE "Driver" ADD COLUMN     "bankAccountName" TEXT,
ADD COLUMN     "bankAccountNumber" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "isPayoutEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastPayoutDate" TIMESTAMP(3),
ADD COLUMN     "totalEarnings" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalPaidOut" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "resetToken" TEXT,
ADD COLUMN     "resetTokenExpiry" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "bankAccountName" TEXT,
ADD COLUMN     "bankAccountNumber" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "isPayoutEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastPayoutDate" TIMESTAMP(3),
ADD COLUMN     "totalEarnings" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalPaidOut" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PayoutRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userType" "PayoutUserType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "bankName" TEXT NOT NULL,
    "bankAccountName" TEXT NOT NULL,
    "bankAccountNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "processedById" TEXT,
    "requestedEarnings" JSONB,
    "notes" TEXT,
    "vendorId" TEXT,
    "driverId" TEXT,
    "transactionId" TEXT,

    CONSTRAINT "PayoutRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayoutRequest_transactionId_key" ON "PayoutRequest"("transactionId");

-- CreateIndex
CREATE INDEX "PayoutRequest_userId_idx" ON "PayoutRequest"("userId");

-- CreateIndex
CREATE INDEX "PayoutRequest_userType_idx" ON "PayoutRequest"("userType");

-- CreateIndex
CREATE INDEX "PayoutRequest_status_idx" ON "PayoutRequest"("status");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutRequest" ADD CONSTRAINT "PayoutRequest_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutRequest" ADD CONSTRAINT "PayoutRequest_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutRequest" ADD CONSTRAINT "PayoutRequest_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutRequest" ADD CONSTRAINT "PayoutRequest_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
