export type ScimName = {
  formatted?: string;
  givenName?: string;
  familyName?: string;
};

export type ScimEmail = {
  value: string;
  primary?: boolean;
  type?: string;
};

export type ScimUserResource = {
  schemas: string[];
  id: string;
  userName: string;
  name?: ScimName;
  displayName?: string;
  active: boolean;
  emails?: ScimEmail[];
  meta: {
    resourceType: "User";
    created: string;
    lastModified: string;
    location: string;
  };
};

export type ScimListResponse = {
  schemas: string[];
  totalResults: number;
  startIndex: number;
  itemsPerPage: number;
  Resources: ScimUserResource[];
};

export const SCIM_USER_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:User";
export const SCIM_LIST_SCHEMA =
  "urn:ietf:params:scim:api:messages:2.0:ListResponse";
export const SCIM_ERROR_SCHEMA =
  "urn:ietf:params:scim:api:messages:2.0:Error";
