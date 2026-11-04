export type AuthUser = {
  id: string;
  email: string;
  name: string;
  isPlatformAdmin: boolean;
};

export type AuthSession = {
  id: string;
  token: string;
  userId: string;
  activeOrganizationId: string | null;
  activeCompanyId: string | null;
  authMethod: "password" | "sso";
  expiresAt: Date;
};

export type RequestAuth = {
  user: AuthUser;
  session: AuthSession;
};
