import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp, resetDatabase } from "./helpers/app";

describe("S2 semantic model + goals", () => {
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

  it("bootstraps semantic model and goal; dashboard returns KPIs", async () => {
    const alice = await register("s2-alice@example.com");
    const org = await request(server)
      .post("/organizations")
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ name: "Org S2", timezone: "America/Puerto_Rico" })
      .expect(201);

    const connection = await request(server)
      .post(`/organizations/${org.body.id}/connections`)
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ name: "Mock BI" })
      .expect(201);

    expect(connection.body.semanticModelId).toBeTruthy();

    const model = await request(server)
      .get(
        `/organizations/${org.body.id}/connections/${connection.body.id}/semantic-model`,
      )
      .set("Authorization", `Bearer ${alice.token}`)
      .expect(200);

    expect(model.body.metrics.length).toBeGreaterThanOrEqual(4);
    expect(model.body.metrics.map((m: { key: string }) => m.key)).toContain(
      "ventas_dia",
    );

    await request(server)
      .post(
        `/organizations/${org.body.id}/connections/${connection.body.id}/sync`,
      )
      .set("Authorization", `Bearer ${alice.token}`)
      .set("Idempotency-Key", "s2-sync-1")
      .expect(201);

    const dashboards = await request(server)
      .get(`/organizations/${org.body.id}/dashboards`)
      .set("Authorization", `Bearer ${alice.token}`)
      .expect(200);

    expect(dashboards.body[0].kpis.length).toBeGreaterThan(0);
    const ventas = dashboards.body[0].kpis.find(
      (k: { key: string }) => k.key === "ventas_dia",
    );
    expect(ventas.value).toEqual(expect.any(Number));
    expect(dashboards.body[0].goals.length).toBeGreaterThan(0);
    expect(dashboards.body[0].goals[0].statusLabel).toMatch(/meta|dato/i);

    const goals = await request(server)
      .post(`/organizations/${org.body.id}/goals`)
      .set("Authorization", `Bearer ${alice.token}`)
      .send({
        name: "Meta de leads",
        metricKey: "leads",
        targetValue: 1000,
        comparator: "gte",
        dashboardId: dashboards.body[0].id,
      })
      .expect(201);

    expect(goals.body.metricKey).toBe("leads");
  });

  it("denies cross-tenant semantic and goal access", async () => {
    const alice = await register("s2-owner@example.com");
    const bob = await register("s2-intruder@example.com");
    const org = await request(server)
      .post("/organizations")
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ name: "Private S2" })
      .expect(201);
    await request(server)
      .post("/organizations")
      .set("Authorization", `Bearer ${bob.token}`)
      .send({ name: "Bob S2" })
      .expect(201);

    const connection = await request(server)
      .post(`/organizations/${org.body.id}/connections`)
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ name: "Secret" })
      .expect(201);

    await request(server)
      .get(
        `/organizations/${org.body.id}/connections/${connection.body.id}/semantic-model`,
      )
      .set("Authorization", `Bearer ${bob.token}`)
      .expect(403);

    await request(server)
      .get(`/organizations/${org.body.id}/goals`)
      .set("Authorization", `Bearer ${bob.token}`)
      .expect(403);

    const bobOrgId = (
      await request(server)
        .get("/organizations")
        .set("Authorization", `Bearer ${bob.token}`)
        .expect(200)
    ).body[0].id as string;

    const hidden = await prisma.withOrganizationContext(bobOrgId, (tx) =>
      tx.semanticModel.findMany(),
    );
    expect(hidden.every((m) => m.organizationId !== org.body.id)).toBe(true);
  });
});
