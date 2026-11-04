import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp, resetDatabase } from "./helpers/app";

describe("S9 OIDC SSO (mock IdP)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: Parameters<typeof request>[0];

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    server = app.getHttpServer();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it("enables mock SSO, completes PKCE login with JIT, skips password", async () => {
    const owner = await request(server)
      .post("/auth/register")
      .send({
        email: "owner@example.com",
        password: "Password123!",
        name: "Owner",
      })
      .expect(201);

    const org = await request(server)
      .post("/organizations")
      .set("Authorization", `Bearer ${owner.body.token}`)
      .send({ name: "SSO Org" })
      .expect(201);

    await request(server)
      .put(`/organizations/${org.body.id}/sso`)
      .set("Authorization", `Bearer ${owner.body.token}`)
      .send({ enabled: true, provider: "mock", jitProvisioning: true })
      .expect(200);

    const status = await request(server)
      .get("/auth/sso/status")
      .query({ organizationId: org.body.id })
      .expect(200);
    expect(status.body.enabled).toBe(true);

    const start = await request(server)
      .get("/auth/sso/start")
      .query({ organizationId: org.body.id })
      .expect(200);
    expect(start.body.authorizeUrl).toContain("/auth/sso/mock/");

    const authorizeUrl = new URL(start.body.authorizeUrl);
    authorizeUrl.searchParams.set("email", "sso.user@example.com");
    authorizeUrl.searchParams.set("name", "SSO User");

    const authorize = await request(server)
      .get(authorizeUrl.pathname + authorizeUrl.search)
      .redirects(0)
      .expect(302);
    const location = authorize.headers.location as string;
    expect(location).toContain("/auth/sso/callback");
    const cb = new URL(location, "http://localhost:3001");

    const callback = await request(server)
      .get("/auth/sso/callback")
      .query({
        code: cb.searchParams.get("code"),
        state: cb.searchParams.get("state"),
        format: "json",
      })
      .expect(200);

    expect(callback.body.token).toBeTruthy();
    expect(callback.body.user.email).toBe("sso.user@example.com");
    expect(callback.body.organizationId).toBe(org.body.id);

    const me = await request(server)
      .get("/auth/me")
      .set("Authorization", `Bearer ${callback.body.token}`)
      .expect(200);
    expect(me.body.memberships.some((m: { organizationId: string }) => m.organizationId === org.body.id)).toBe(
      true,
    );

    // SSO-only user cannot password-login
    await request(server)
      .post("/auth/login")
      .send({ email: "sso.user@example.com", password: "anything" })
      .expect(401);

    const identity = await prisma.userSsoIdentity.findFirst({
      where: { email: "sso.user@example.com" },
    });
    expect(identity?.organizationId).toBe(org.body.id);
  });

  it("rejects start when SSO disabled", async () => {
    const owner = await request(server)
      .post("/auth/register")
      .send({
        email: "owner2@example.com",
        password: "Password123!",
        name: "Owner2",
      })
      .expect(201);
    const org = await request(server)
      .post("/organizations")
      .set("Authorization", `Bearer ${owner.body.token}`)
      .send({ name: "No SSO" })
      .expect(201);

    await request(server)
      .get("/auth/sso/start")
      .query({ organizationId: org.body.id })
      .expect(400);
  });
});
