-- S7: audit hash-chain fields for tamper-evident export

ALTER TABLE "AuditEvent" ADD COLUMN "prevHash" TEXT;
ALTER TABLE "AuditEvent" ADD COLUMN "eventHash" TEXT;

CREATE INDEX "AuditEvent_organizationId_eventHash_idx" ON "AuditEvent"("organizationId", "eventHash");
