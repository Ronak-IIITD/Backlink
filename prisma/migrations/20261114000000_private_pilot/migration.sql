-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "suspended" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "renderMode" TEXT NOT NULL DEFAULT 'javascript';

-- AlterTable
ALTER TABLE "ReportSchedule" ADD COLUMN     "lastReportId" TEXT;

-- AlterTable
ALTER TABLE "Crawl" ADD COLUMN     "activeProjectId" TEXT,
ADD COLUMN     "coverage" TEXT,
ADD COLUMN     "leaseExpiresAt" TIMESTAMP(3),
ADD COLUMN     "leaseToken" TEXT,
ADD COLUMN     "reservationId" TEXT,
ADD COLUMN     "scoreVersion" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Page" ADD COLUMN     "auditError" TEXT,
ADD COLUMN     "h1Count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rendered" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "AIAction" ADD COLUMN     "activeIssueId" TEXT,
ADD COLUMN     "reportedAt" TIMESTAMP(3),
ADD COLUMN     "reservationId" TEXT,
ADD COLUMN     "verificationCrawlId" TEXT,
ADD COLUMN     "verifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ContentOpportunity" ADD COLUMN     "crawlId" TEXT;

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessPeriod" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "auditLimit" INTEGER NOT NULL,
    "draftLimit" INTEGER NOT NULL,
    "auditsUsed" INTEGER NOT NULL DEFAULT 0,
    "draftsUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageReservation" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'reserved',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsageReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetBucket" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "used" INTEGER NOT NULL DEFAULT 0,
    "limit" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetBucket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderCall" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "provider" TEXT NOT NULL,
    "bucketId" TEXT NOT NULL,
    "reserved" INTEGER NOT NULL,
    "charged" INTEGER,
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "tokenBucketId" TEXT,
    "tokenReservation" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'reserved',
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ProviderCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailDelivery" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "Invitation_email_idx" ON "Invitation"("email");

-- CreateIndex
CREATE INDEX "AccessPeriod_organizationId_startsAt_endsAt_idx" ON "AccessPeriod"("organizationId", "startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "UsageReservation_key_key" ON "UsageReservation"("key");

-- CreateIndex
CREATE INDEX "UsageReservation_periodId_status_idx" ON "UsageReservation"("periodId", "status");

-- CreateIndex
CREATE INDEX "BudgetBucket_organizationId_idx" ON "BudgetBucket"("organizationId");

-- CreateIndex
CREATE INDEX "ProviderCall_organizationId_createdAt_idx" ON "ProviderCall"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "ProviderCall_status_createdAt_idx" ON "ProviderCall"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailDelivery_key_key" ON "EmailDelivery"("key");

-- CreateIndex
CREATE INDEX "EmailDelivery_organizationId_idx" ON "EmailDelivery"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Crawl_activeProjectId_key" ON "Crawl"("activeProjectId");

-- CreateIndex
CREATE UNIQUE INDEX "Crawl_reservationId_key" ON "Crawl"("reservationId");

-- CreateIndex
CREATE UNIQUE INDEX "AIAction_activeIssueId_key" ON "AIAction"("activeIssueId");

-- CreateIndex
CREATE UNIQUE INDEX "AIAction_reservationId_key" ON "AIAction"("reservationId");

-- AddForeignKey
ALTER TABLE "AccessPeriod" ADD CONSTRAINT "AccessPeriod_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageReservation" ADD CONSTRAINT "UsageReservation_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccessPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Revoke legacy public approval capabilities for the private pilot.
UPDATE "ShareLink" SET "expiresAt" = CURRENT_TIMESTAMP;
