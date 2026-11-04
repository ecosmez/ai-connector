-- S10: org-scoped SCIM bearer tokens

CREATE TABLE "OrganizationScimToken" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT,

    CONSTRAINT "OrganizationScimToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationScimToken_tokenHash_key" ON "OrganizationScimToken"("tokenHash");
CREATE INDEX "OrganizationScimToken_organizationId_idx" ON "OrganizationScimToken"("organizationId");

ALTER TABLE "OrganizationScimToken" ADD CONSTRAINT "OrganizationScimToken_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizationScimToken" ADD CONSTRAINT "OrganizationScimToken_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrganizationScimToken" ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_isolation_organization_scim_token ON "OrganizationScimToken"
  USING (
    COALESCE(current_setting('app.current_org_id', true), '') = ''
    OR "organizationId" = current_setting('app.current_org_id', true)
  );
