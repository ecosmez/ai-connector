-- S9: OIDC SSO (org config + login state + identities). passwordHash optional for SSO-only users.

ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

CREATE TABLE "OrganizationSsoConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "issuer" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecretCiphertext" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "jitProvisioning" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationSsoConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationSsoConfig_organizationId_key" ON "OrganizationSsoConfig"("organizationId");

CREATE TABLE "SsoAuthState" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "codeVerifier" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SsoAuthState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SsoAuthState_state_key" ON "SsoAuthState"("state");
CREATE INDEX "SsoAuthState_organizationId_idx" ON "SsoAuthState"("organizationId");

CREATE TABLE "SsoAuthorizationCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "codeChallenge" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SsoAuthorizationCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SsoAuthorizationCode_code_key" ON "SsoAuthorizationCode"("code");
CREATE INDEX "SsoAuthorizationCode_organizationId_idx" ON "SsoAuthorizationCode"("organizationId");

CREATE TABLE "UserSsoIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSsoIdentity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserSsoIdentity_issuer_subject_key" ON "UserSsoIdentity"("issuer", "subject");
CREATE UNIQUE INDEX "UserSsoIdentity_organizationId_userId_key" ON "UserSsoIdentity"("organizationId", "userId");
CREATE INDEX "UserSsoIdentity_userId_idx" ON "UserSsoIdentity"("userId");

ALTER TABLE "OrganizationSsoConfig" ADD CONSTRAINT "OrganizationSsoConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SsoAuthState" ADD CONSTRAINT "SsoAuthState_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SsoAuthorizationCode" ADD CONSTRAINT "SsoAuthorizationCode_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserSsoIdentity" ADD CONSTRAINT "UserSsoIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserSsoIdentity" ADD CONSTRAINT "UserSsoIdentity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS on org-scoped SSO tables
ALTER TABLE "OrganizationSsoConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SsoAuthState" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SsoAuthorizationCode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserSsoIdentity" ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_isolation_organization_sso_config ON "OrganizationSsoConfig"
  USING (
    COALESCE(current_setting('app.current_org_id', true), '') = ''
    OR "organizationId" = current_setting('app.current_org_id', true)
  );

CREATE POLICY org_isolation_sso_auth_state ON "SsoAuthState"
  USING (
    COALESCE(current_setting('app.current_org_id', true), '') = ''
    OR "organizationId" = current_setting('app.current_org_id', true)
  );

CREATE POLICY org_isolation_sso_authorization_code ON "SsoAuthorizationCode"
  USING (
    COALESCE(current_setting('app.current_org_id', true), '') = ''
    OR "organizationId" = current_setting('app.current_org_id', true)
  );

CREATE POLICY org_isolation_user_sso_identity ON "UserSsoIdentity"
  USING (
    COALESCE(current_setting('app.current_org_id', true), '') = ''
    OR "organizationId" = current_setting('app.current_org_id', true)
  );
