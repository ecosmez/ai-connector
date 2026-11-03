import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp, resetDatabase } from "./helpers/app";

describe("S7 audit hash-chain + export", () => {
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

  it("records hashed events and verifies/export the org chain", async () => {
    const alice = await request(server)
      .post("/auth/register")
      .send({
        email: "s7-alice@example.com",
        password: "Password123!",
        name: "Alice Audit",
      })
      .expect(201);
    const org = await request(server)
      .post("/organizations")
      .set("Authorization", `Bearer ${alice.body.token}`)
      .send({ name: "Org Audit", timezone: "America/Puerto_Rico" })
      .expect(201);

    const list = await request(server)
      .get(`/organizations/${org.body.id}/audit-events`)
      .set("Authorization", `Bearer ${alice.body.token}`)
      .expect(200);
    expect(list.body.items.length).toBeGreaterThanOrEqual(1);
    expect(list.body.items[0].eventHash).toMatch(/^[a-f0-9]{64}$/);

    const verify = await request(server)
      .get(`/organizations/${org.body.id}/audit-events/verify`)
      .set("Authorization", `Bearer ${alice.body.token}`)
      .expect(200);
    expect(verify.body.valid).toBe(true);
    expect(verify.body.eventsChecked).toBeGreaterThanOrEqual(1);

    const exported = await request(server)
      .get(`/organizations/${org.body.id}/audit-events/export`)
      .set("Authorization", `Bearer ${alice.body.token}`)
      .expect(200);
    expect(exported.body.chainValid).toBe(true);
    expect(exported.body.events.length).toBe(verify.body.totalEvents);

    // Tamper with a hashed row → verify fails.
    const victim = exported.body.events[exported.body.events.length - 1];
    await prisma.$executeRawUnsafe(
      `SELECT set_config('app.current_org_id', '', true)`,
    );
    await prisma.auditEvent.update({
      where: { id: victim.id },
      data: { action: "tampered.action" },
    });

    const broken = await request(server)
      .get(`/organizations/${org.body.id}/audit-events/verify`)
      .set("Authorization", `Bearer ${alice.body.token}`)
      .expect(200);
    expect(broken.body.valid).toBe(false);
    expect(broken.body.firstInvalidId).toBe(victim.id);
  });

  it("denies cross-tenant audit export", async () => {
    const alice = await request(server)
      .post("/auth/register")
      .send({
        email: "s7-a@example.com",
        password: "Password123!",
        name: "A",
      })
      .expect(201);
    const org = await request(server)
      .post("/organizations")
      .set("Authorization", `Bearer ${alice.body.token}`)
      .send({ name: "Private" })
      .expect(201);
    const bob = await request(server)
      .post("/auth/register")
      .send({
        email: "s7-b@example.com",
        password: "Password123!",
        name: "B",
      })
      .expect(201);
    await request(server)
      .post("/organizations")
      .set("Authorization", `Bearer ${bob.body.token}`)
      .send({ name: "Other" })
      .expect(201);

    await request(server)
      .get(`/organizations/${org.body.id}/audit-events/export`)
      .set("Authorization", `Bearer ${bob.body.token}`)
      .expect(403);
  });
});
