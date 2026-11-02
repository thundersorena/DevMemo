-- AlterTable
ALTER TABLE "user" ADD COLUMN     "githubLogin" TEXT;

-- CreateTable
CREATE TABLE "github_hook" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "secretEncrypted" TEXT NOT NULL,
    "onlyOwnCommits" BOOLEAN NOT NULL DEFAULT true,
    "lastDeliveryAt" TIMESTAMP(3),
    "lastDeliveryStatus" TEXT,
    "lastDeliveryMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "github_hook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_token" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_token_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "github_hook_userId_key" ON "github_hook"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "api_token_tokenHash_key" ON "api_token"("tokenHash");

-- CreateIndex
CREATE INDEX "api_token_userId_idx" ON "api_token"("userId");

-- AddForeignKey
ALTER TABLE "github_hook" ADD CONSTRAINT "github_hook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_token" ADD CONSTRAINT "api_token_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
