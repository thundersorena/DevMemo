-- AlterTable: "only own commits" moves from the manual webhook to the user
ALTER TABLE "user" ADD COLUMN "onlyOwnCommits" BOOLEAN NOT NULL DEFAULT true;
UPDATE "user" u SET "onlyOwnCommits" = h."onlyOwnCommits" FROM "github_hook" h WHERE h."userId" = u."id";
ALTER TABLE "github_hook" DROP COLUMN "onlyOwnCommits";

-- CreateTable
CREATE TABLE "github_installation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "accountLogin" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "repositorySelection" TEXT NOT NULL,
    "suspendedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "github_installation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "github_repository" (
    "id" TEXT NOT NULL,
    "installationRef" TEXT NOT NULL,
    "repoId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "private" BOOLEAN NOT NULL DEFAULT false,
    "defaultBranch" TEXT,
    "backfillStatus" TEXT NOT NULL DEFAULT 'pending',
    "backfillMessage" TEXT,
    "backfilledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "github_repository_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "github_installation_installationId_idx" ON "github_installation"("installationId");

-- CreateIndex
CREATE UNIQUE INDEX "github_installation_userId_installationId_key" ON "github_installation"("userId", "installationId");

-- CreateIndex
CREATE UNIQUE INDEX "github_repository_installationRef_repoId_key" ON "github_repository"("installationRef", "repoId");

-- AddForeignKey
ALTER TABLE "github_installation" ADD CONSTRAINT "github_installation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "github_repository" ADD CONSTRAINT "github_repository_installationRef_fkey" FOREIGN KEY ("installationRef") REFERENCES "github_installation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
