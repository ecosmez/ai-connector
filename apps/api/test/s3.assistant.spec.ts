import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp, resetDatabase } from "./helpers/app";

describe("S3 assistant", () => {
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

  async function register(email: string) {
    const res = await request(server)
      .post("/auth/register")
      .send({ email, password: "Password123!", name: "User" })
      .expect(201);
    return res.body as { token: string; user: { id: string } };
  }

  it("answers with tool-backed KPI data via mock provider", async () => {
    const alice = await register("s3-alice@example.com");
    const org = await request(server)
      .post("/organizations")
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ name: "Org AI", timezone: "America/Puerto_Rico" })
      .expect(201);

    const connection = await request(server)
      .post(`/organizations/${org.body.id}/connections`)
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ name: "Mock AI" })
      .expect(201);

    await request(server)
      .post(
        `/organizations/${org.body.id}/connections/${connection.body.id}/sync`,
      )
      .set("Authorization", `Bearer ${alice.token}`)
      .set("Idempotency-Key", "s3-sync")
      .expect(201);

    const thread = await request(server)
      .post(`/organizations/${org.body.id}/assistant/threads`)
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ title: "Ventas" })
      .expect(201);

    const turn = await request(server)
      .post(
        `/organizations/${org.body.id}/assistant/threads/${thread.body.id}/messages`,
      )
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ content: "¿Cómo van las ventas y los KPIs del dashboard?" })
      .expect(201);

    expect(turn.body.provider).toBe("mock");
    expect(turn.body.toolsUsed.length).toBeGreaterThan(0);
    expect(turn.body.message.content.toLowerCase()).toMatch(
      /dashboard|kpi|venta|organización|organizacion/,
    );

    const detail = await request(server)
      .get(
        `/organizations/${org.body.id}/assistant/threads/${thread.body.id}`,
      )
      .set("Authorization", `Bearer ${alice.token}`)
      .expect(200);

    expect(detail.body.messages.some((m: { role: string }) => m.role === "user")).toBe(
      true,
    );
    expect(
      detail.body.messages.some((m: { role: string }) => m.role === "assistant"),
    ).toBe(true);
    expect(
      detail.body.messages.some((m: { role: string }) => m.role === "tool"),
    ).toBe(true);
  });

  it("denies cross-tenant assistant access", async () => {
    const alice = await register("s3-owner@example.com");
    const bob = await register("s3-intruder@example.com");
    const org = await request(server)
      .post("/organizations")
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ name: "Private AI" })
      .expect(201);
    await request(server)
      .post("/organizations")
      .set("Authorization", `Bearer ${bob.token}`)
      .send({ name: "Bob AI" })
      .expect(201);

    const thread = await request(server)
      .post(`/organizations/${org.body.id}/assistant/threads`)
      .set("Authorization", `Bearer ${alice.token}`)
      .send({})
      .expect(201);

    await request(server)
      .get(`/organizations/${org.body.id}/assistant/threads`)
      .set("Authorization", `Bearer ${bob.token}`)
      .expect(403);

    await request(server)
      .post(
        `/organizations/${org.body.id}/assistant/threads/${thread.body.id}/messages`,
      )
      .set("Authorization", `Bearer ${bob.token}`)
      .send({ content: "hola" })
      .expect(403);

    const bobOrgId = (
      await request(server)
        .get("/organizations")
        .set("Authorization", `Bearer ${bob.token}`)
        .expect(200)
    ).body[0].id as string;

    const hidden = await prisma.withOrganizationContext(bobOrgId, (tx) =>
      tx.assistantThread.findMany(),
    );
    expect(hidden.every((t) => t.organizationId !== org.body.id)).toBe(true);
  });
});
