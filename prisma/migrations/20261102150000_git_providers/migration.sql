-- AlterTable
ALTER TABLE "user" ADD COLUMN "authorEmails" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "commit" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'github';

-- CreateTable
CREATE TABLE "provider_hook" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "secretEncrypted" TEXT NOT NULL,
    "lastDeliveryAt" TIMESTAMP(3),
    "lastDeliveryStatus" TEXT,
    "lastDeliveryMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_hook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "provider_hook_userId_provider_key" ON "provider_hook"("userId", "provider");

-- AddForeignKey
ALTER TABLE "provider_hook" ADD CONSTRAINT "provider_hook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
