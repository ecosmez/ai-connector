-- Treat missing app.current_org_id as unrestricted (bootstrap / non-tenant ops).
-- current_setting(..., true) returns NULL when unset; NULL = '' is not true in SQL.

DROP POLICY IF EXISTS company_tenant_isolation ON "Company";
DROP POLICY IF EXISTS membership_tenant_isolation ON "Membership";
DROP POLICY IF EXISTS role_tenant_isolation ON "Role";
DROP POLICY IF EXISTS role_binding_tenant_isolation ON "RoleBinding";
DROP POLICY IF EXISTS audit_tenant_isolation ON "AuditEvent";

CREATE POLICY company_tenant_isolation ON "Company"
  USING (
    COALESCE(current_setting('app.current_org_id', true), '') = ''
    OR "organizationId" = current_setting('app.current_org_id', true)
  );

CREATE POLICY membership_tenant_isolation ON "Membership"
  USING (
    COALESCE(current_setting('app.current_org_id', true), '') = ''
    OR "organizationId" = current_setting('app.current_org_id', true)
  );

CREATE POLICY role_tenant_isolation ON "Role"
  USING (
    COALESCE(current_setting('app.current_org_id', true), '') = ''
    OR "organizationId" IS NULL
    OR "organizationId" = current_setting('app.current_org_id', true)
  );

CREATE POLICY role_binding_tenant_isolation ON "RoleBinding"
  USING (
    COALESCE(current_setting('app.current_org_id', true), '') = ''
    OR "organizationId" = current_setting('app.current_org_id', true)
  );

CREATE POLICY audit_tenant_isolation ON "AuditEvent"
  USING (
    COALESCE(current_setting('app.current_org_id', true), '') = ''
    OR "organizationId" IS NULL
    OR "organizationId" = current_setting('app.current_org_id', true)
  );
