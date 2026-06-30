-- CreateEnum
CREATE TYPE "BotSessionStatus" AS ENUM ('running', 'success', 'partial', 'failed');

-- CreateEnum
CREATE TYPE "BotFindingSeverity" AS ENUM ('error', 'warning', 'info', 'expected');

-- CreateTable
CREATE TABLE "BotPopulationSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "division" TEXT NOT NULL,
    "seed" INTEGER NOT NULL DEFAULT 1,
    "mode" TEXT NOT NULL DEFAULT 'populate',
    "status" "BotSessionStatus" NOT NULL DEFAULT 'running',
    "config" JSONB NOT NULL,
    "concurrentUsers" INTEGER NOT NULL DEFAULT 1,
    "impersonatedAs" TEXT,
    "summary" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "BotPopulationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotPopulationStep" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "requested" JSONB NOT NULL,
    "created" INTEGER NOT NULL DEFAULT 0,
    "edited" INTEGER NOT NULL DEFAULT 0,
    "deleted" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "meta" JSONB,

    CONSTRAINT "BotPopulationStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotPopulationFinding" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "stepId" TEXT,
    "moduleId" TEXT NOT NULL,
    "severity" "BotFindingSeverity" NOT NULL,
    "faultId" TEXT,
    "expected" BOOLEAN NOT NULL DEFAULT false,
    "message" TEXT NOT NULL,
    "links" JSONB NOT NULL DEFAULT '[]',
    "remediation" TEXT,
    "entityRefs" JSONB,

    CONSTRAINT "BotPopulationFinding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BotPopulationSession_tenantId_startedAt_idx" ON "BotPopulationSession"("tenantId", "startedAt");

-- CreateIndex
CREATE INDEX "BotPopulationSession_actorUserId_idx" ON "BotPopulationSession"("actorUserId");

-- CreateIndex
CREATE INDEX "BotPopulationStep_sessionId_idx" ON "BotPopulationStep"("sessionId");

-- CreateIndex
CREATE INDEX "BotPopulationFinding_sessionId_idx" ON "BotPopulationFinding"("sessionId");

-- CreateIndex
CREATE INDEX "BotPopulationFinding_sessionId_severity_idx" ON "BotPopulationFinding"("sessionId", "severity");

-- AddForeignKey
ALTER TABLE "BotPopulationSession" ADD CONSTRAINT "BotPopulationSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotPopulationSession" ADD CONSTRAINT "BotPopulationSession_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotPopulationStep" ADD CONSTRAINT "BotPopulationStep_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "BotPopulationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotPopulationFinding" ADD CONSTRAINT "BotPopulationFinding_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "BotPopulationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
