-- CreateTable
CREATE TABLE "Connection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "companyId" TEXT,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "status" TEXT NOT NULL DEFAULT 'active',
    "config" JSONB NOT NULL DEFAULT '{}',
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Connection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "etag" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "idempotencyKey" TEXT,
    "errorMessage" TEXT,
    "snapshotId" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dashboard" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "companyId" TEXT,
    "connectionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "staleAfterHours" INTEGER NOT NULL DEFAULT 26,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dashboard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Connection_organizationId_idx" ON "Connection"("organizationId");

-- CreateIndex
CREATE INDEX "Connection_organizationId_companyId_idx" ON "Connection"("organizationId", "companyId");

-- CreateIndex
CREATE INDEX "DataSnapshot_organizationId_connectionId_idx" ON "DataSnapshot"("organizationId", "connectionId");

-- CreateIndex
CREATE UNIQUE INDEX "DataSnapshot_connectionId_version_key" ON "DataSnapshot"("connectionId", "version");

-- CreateIndex
CREATE INDEX "SyncRun_connectionId_createdAt_idx" ON "SyncRun"("connectionId", "createdAt");

-- CreateIndex
CREATE INDEX "SyncRun_organizationId_createdAt_idx" ON "SyncRun"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SyncRun_organizationId_idempotencyKey_key" ON "SyncRun"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "Dashboard_organizationId_idx" ON "Dashboard"("organizationId");

-- CreateIndex
CREATE INDEX "Dashboard_connectionId_idx" ON "Dashboard"("connectionId");

-- AddForeignKey
ALTER TABLE "Connection" ADD CONSTRAINT "Connection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Connection" ADD CONSTRAINT "Connection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataSnapshot" ADD CONSTRAINT "DataSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataSnapshot" ADD CONSTRAINT "DataSnapshot_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncRun" ADD CONSTRAINT "SyncRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncRun" ADD CONSTRAINT "SyncRun_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dashboard" ADD CONSTRAINT "Dashboard_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dashboard" ADD CONSTRAINT "Dashboard_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dashboard" ADD CONSTRAINT "Dashboard_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS (defense in depth; same GUC pattern as S0)
ALTER TABLE "Connection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DataSnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SyncRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Dashboard" ENABLE ROW LEVEL SECURITY;

CREATE POLICY connection_tenant_isolation ON "Connection"
  USING (
    COALESCE(current_setting('app.current_org_id', true), '') = ''
    OR "organizationId" = current_setting('app.current_org_id', true)
  );

CREATE POLICY data_snapshot_tenant_isolation ON "DataSnapshot"
  USING (
    COALESCE(current_setting('app.current_org_id', true), '') = ''
    OR "organizationId" = current_setting('app.current_org_id', true)
  );

CREATE POLICY sync_run_tenant_isolation ON "SyncRun"
  USING (
    COALESCE(current_setting('app.current_org_id', true), '') = ''
    OR "organizationId" = current_setting('app.current_org_id', true)
  );

CREATE POLICY dashboard_tenant_isolation ON "Dashboard"
  USING (
    COALESCE(current_setting('app.current_org_id', true), '') = ''
    OR "organizationId" = current_setting('app.current_org_id', true)
  );

ALTER TABLE "Connection" FORCE ROW LEVEL SECURITY;
ALTER TABLE "DataSnapshot" FORCE ROW LEVEL SECURITY;
ALTER TABLE "SyncRun" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Dashboard" FORCE ROW LEVEL SECURITY;
