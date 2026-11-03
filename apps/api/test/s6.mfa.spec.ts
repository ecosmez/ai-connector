import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { generateTotpCode } from "../src/auth/totp";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp, resetDatabase } from "./helpers/app";

describe("S6 MFA step-up", () => {
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

  it("enrolls TOTP and requires MFA on subsequent login", async () => {
    const reg = await request(server)
      .post("/auth/register")
      .send({
        email: "s6-alice@example.com",
        password: "Password123!",
        name: "Alice MFA",
      })
      .expect(201);
    const token = reg.body.token as string;

    const setup = await request(server)
      .post("/auth/mfa/setup")
      .set("Authorization", `Bearer ${token}`)
      .expect(201);
    expect(setup.body.secret).toBeTruthy();
    expect(setup.body.otpauthUrl).toContain("otpauth://totp/");

    const code = generateTotpCode(setup.body.secret);
    await request(server)
      .post("/auth/mfa/enable")
      .set("Authorization", `Bearer ${token}`)
      .send({ code })
      .expect(201);

    const status = await request(server)
      .get("/auth/mfa")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(status.body.enabled).toBe(true);

    await request(server)
      .post("/auth/logout")
      .set("Authorization", `Bearer ${token}`)
      .expect(201);

    const login = await request(server)
      .post("/auth/login")
      .send({ email: "s6-alice@example.com", password: "Password123!" })
      .expect(201);
    expect(login.body.mfaRequired).toBe(true);
    expect(login.body.mfaToken).toBeTruthy();
    expect(login.body.token).toBeUndefined();

    const bad = await request(server)
      .post("/auth/mfa/verify")
      .send({ mfaToken: login.body.mfaToken, code: "000000" })
      .expect(401);
    expect(bad.body.code).toBe("mfa_invalid_code");

    const okCode = generateTotpCode(setup.body.secret);
    const verified = await request(server)
      .post("/auth/mfa/verify")
      .send({ mfaToken: login.body.mfaToken, code: okCode })
      .expect(201);
    expect(verified.body.token).toBeTruthy();

    // Challenge is single-use.
    await request(server)
      .post("/auth/mfa/verify")
      .send({ mfaToken: login.body.mfaToken, code: okCode })
      .expect(401);
  });

  it("disables MFA with password + code", async () => {
    const reg = await request(server)
      .post("/auth/register")
      .send({
        email: "s6-bob@example.com",
        password: "Password123!",
        name: "Bob MFA",
      })
      .expect(201);
    const token = reg.body.token as string;
    const setup = await request(server)
      .post("/auth/mfa/setup")
      .set("Authorization", `Bearer ${token}`)
      .expect(201);
    const enableCode = generateTotpCode(setup.body.secret);
    await request(server)
      .post("/auth/mfa/enable")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: enableCode })
      .expect(201);

    const disableCode = generateTotpCode(setup.body.secret);
    await request(server)
      .post("/auth/mfa/disable")
      .set("Authorization", `Bearer ${token}`)
      .send({ password: "Password123!", code: disableCode })
      .expect(201);

    const login = await request(server)
      .post("/auth/login")
      .send({ email: "s6-bob@example.com", password: "Password123!" })
      .expect(201);
    expect(login.body.mfaRequired).toBeFalsy();
    expect(login.body.token).toBeTruthy();
  });
});
