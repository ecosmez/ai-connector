-- CreateTable
CREATE TABLE "SemanticModel" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SemanticModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricDefinition" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "semanticModelId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "sourcePath" TEXT NOT NULL,
    "aggregation" TEXT NOT NULL DEFAULT 'latest',
    "unit" TEXT,
    "format" TEXT NOT NULL DEFAULT 'number',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetricDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "companyId" TEXT,
    "dashboardId" TEXT,
    "metricKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "comparator" TEXT NOT NULL DEFAULT 'gte',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SemanticModel_connectionId_key" ON "SemanticModel"("connectionId");

-- CreateIndex
CREATE INDEX "SemanticModel_organizationId_idx" ON "SemanticModel"("organizationId");

-- CreateIndex
CREATE INDEX "MetricDefinition_organizationId_idx" ON "MetricDefinition"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "MetricDefinition_semanticModelId_key_key" ON "MetricDefinition"("semanticModelId", "key");

-- CreateIndex
CREATE INDEX "Goal_organizationId_idx" ON "Goal"("organizationId");

-- CreateIndex
CREATE INDEX "Goal_dashboardId_idx" ON "Goal"("dashboardId");

-- CreateIndex
CREATE INDEX "Goal_metricKey_idx" ON "Goal"("metricKey");

-- AddForeignKey
ALTER TABLE "SemanticModel" ADD CONSTRAINT "SemanticModel_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemanticModel" ADD CONSTRAINT "SemanticModel_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricDefinition" ADD CONSTRAINT "MetricDefinition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricDefinition" ADD CONSTRAINT "MetricDefinition_semanticModelId_fkey" FOREIGN KEY ("semanticModelId") REFERENCES "SemanticModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "Dashboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS
ALTER TABLE "SemanticModel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MetricDefinition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Goal" ENABLE ROW LEVEL SECURITY;

CREATE POLICY semantic_model_tenant_isolation ON "SemanticModel"
  USING (
    COALESCE(current_setting('app.current_org_id', true), '') = ''
    OR "organizationId" = current_setting('app.current_org_id', true)
  );

CREATE POLICY metric_definition_tenant_isolation ON "MetricDefinition"
  USING (
    COALESCE(current_setting('app.current_org_id', true), '') = ''
    OR "organizationId" = current_setting('app.current_org_id', true)
  );

CREATE POLICY goal_tenant_isolation ON "Goal"
  USING (
    COALESCE(current_setting('app.current_org_id', true), '') = ''
    OR "organizationId" = current_setting('app.current_org_id', true)
  );

ALTER TABLE "SemanticModel" FORCE ROW LEVEL SECURITY;
ALTER TABLE "MetricDefinition" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Goal" FORCE ROW LEVEL SECURITY;
