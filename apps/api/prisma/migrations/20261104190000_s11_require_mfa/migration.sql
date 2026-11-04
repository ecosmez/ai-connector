-- S11: org-wide require MFA + session auth method (SSO exempt)

ALTER TABLE "Organization" ADD COLUMN "requireMfa" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Session" ADD COLUMN "authMethod" TEXT NOT NULL DEFAULT 'password';
