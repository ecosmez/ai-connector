export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

export type AuthSession = {
  id: string;
  token: string;
  userId: string;
  activeOrganizationId: string | null;
  activeCompanyId: string | null;
  expiresAt: Date;
};

export type RequestAuth = {
  user: AuthUser;
  session: AuthSession;
};
