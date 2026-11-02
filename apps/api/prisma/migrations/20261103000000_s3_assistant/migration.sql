-- CreateTable
CREATE TABLE "AssistantThread" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Consulta',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantMessage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "userId" TEXT,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolName" TEXT,
    "toolPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssistantThread_organizationId_userId_idx" ON "AssistantThread"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "AssistantThread_organizationId_createdAt_idx" ON "AssistantThread"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AssistantMessage_threadId_createdAt_idx" ON "AssistantMessage"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "AssistantMessage_organizationId_idx" ON "AssistantMessage"("organizationId");

-- AddForeignKey
ALTER TABLE "AssistantThread" ADD CONSTRAINT "AssistantThread_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantThread" ADD CONSTRAINT "AssistantThread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantMessage" ADD CONSTRAINT "AssistantMessage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantMessage" ADD CONSTRAINT "AssistantMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "AssistantThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantMessage" ADD CONSTRAINT "AssistantMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS
ALTER TABLE "AssistantThread" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AssistantMessage" ENABLE ROW LEVEL SECURITY;

CREATE POLICY assistant_thread_tenant_isolation ON "AssistantThread"
  USING (
    COALESCE(current_setting('app.current_org_id', true), '') = ''
    OR "organizationId" = current_setting('app.current_org_id', true)
  );

CREATE POLICY assistant_message_tenant_isolation ON "AssistantMessage"
  USING (
    COALESCE(current_setting('app.current_org_id', true), '') = ''
    OR "organizationId" = current_setting('app.current_org_id', true)
  );

ALTER TABLE "AssistantThread" FORCE ROW LEVEL SECURITY;
ALTER TABLE "AssistantMessage" FORCE ROW LEVEL SECURITY;
