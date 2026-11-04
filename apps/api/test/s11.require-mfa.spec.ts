import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { generateTotpCode } from "../src/auth/totp";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp, resetDatabase } from "./helpers/app";

describe("S11 org require-MFA policy", () => {
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

  it("blocks enabling policy without personal MFA; blocks password login without MFA", async () => {
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
      .send({ name: "MFA Org" })
      .expect(201);

    await request(server)
      .put(`/organizations/${org.body.id}/security-policy`)
      .set("Authorization", `Bearer ${owner.body.token}`)
      .send({ requireMfa: true })
      .expect(400);

    const setup = await request(server)
      .post("/auth/mfa/setup")
      .set("Authorization", `Bearer ${owner.body.token}`)
      .expect(201);
    const code = generateTotpCode(setup.body.secret);
    await request(server)
      .post("/auth/mfa/enable")
      .set("Authorization", `Bearer ${owner.body.token}`)
      .send({ code })
      .expect(201);

    const policy = await request(server)
      .put(`/organizations/${org.body.id}/security-policy`)
      .set("Authorization", `Bearer ${owner.body.token}`)
      .send({ requireMfa: true })
      .expect(200);
    expect(policy.body.requireMfa).toBe(true);

    // Member without MFA cannot password-login
    const member = await request(server)
      .post("/auth/register")
      .send({
        email: "member@example.com",
        password: "Password123!",
        name: "Member",
      })
      .expect(201);
    await prisma.membership.create({
      data: {
        organizationId: org.body.id,
        userId: member.body.user.id,
        status: "active",
      },
    });

    const denied = await request(server)
      .post("/auth/login")
      .send({ email: "member@example.com", password: "Password123!" })
      .expect(403);
    expect(denied.body.code).toBe("mfa_enrollment_required");

    // Owner still logs in via MFA step-up
    await request(server)
      .post("/auth/logout")
      .set("Authorization", `Bearer ${owner.body.token}`)
      .expect(201);
    const login = await request(server)
      .post("/auth/login")
      .send({ email: "owner@example.com", password: "Password123!" })
      .expect(201);
    expect(login.body.mfaRequired).toBe(true);
  });
});
