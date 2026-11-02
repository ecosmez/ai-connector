import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp, resetDatabase } from "./helpers/app";

describe("S1 mock connector → sync → dashboard", () => {
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

  async function register(email: string, name: string) {
    const res = await request(server)
      .post("/auth/register")
      .send({ email, password: "Password123!", name })
      .expect(201);
    return res.body as { token: string; user: { id: string } };
  }

  async function createOrg(token: string, name: string) {
    const res = await request(server)
      .post("/organizations")
      .set("Authorization", `Bearer ${token}`)
      .send({ name, timezone: "America/Puerto_Rico" })
      .expect(201);
    return res.body as { id: string };
  }

  it("creates mock connection with dashboard, syncs, and reports freshness", async () => {
    const alice = await register("s1-alice@example.com", "Alice");
    const org = await createOrg(alice.token, "Org Sync");

    const connection = await request(server)
      .post(`/organizations/${org.id}/connections`)
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ name: "Conector de prueba" })
      .expect(201);

    expect(connection.body.provider).toBe("mock");
    expect(connection.body.dashboardId).toBeTruthy();

    const sync = await request(server)
      .post(`/organizations/${org.id}/connections/${connection.body.id}/sync`)
      .set("Authorization", `Bearer ${alice.token}`)
      .set("Idempotency-Key", "sync-key-1")
      .expect(201);

    expect(sync.body.status).toBe("succeeded");
    expect(sync.body.snapshotId).toBeTruthy();

    const again = await request(server)
      .post(`/organizations/${org.id}/connections/${connection.body.id}/sync`)
      .set("Authorization", `Bearer ${alice.token}`)
      .set("Idempotency-Key", "sync-key-1")
      .expect(201);

    expect(again.body.id).toBe(sync.body.id);

    const dashboards = await request(server)
      .get(`/organizations/${org.id}/dashboards`)
      .set("Authorization", `Bearer ${alice.token}`)
      .expect(200);

    expect(dashboards.body).toHaveLength(1);
    expect(dashboards.body[0].freshness).toBe("fresh");
    expect(dashboards.body[0].freshnessLabel).toBe("Fresco");
    expect(dashboards.body[0].snapshot?.payload?.source).toBe("mock");

    const dashboardId = dashboards.body[0].id as string;
    const etag = dashboards.body[0].etag as string;

    const cached = await request(server)
      .get(`/organizations/${org.id}/dashboards/${dashboardId}`)
      .set("Authorization", `Bearer ${alice.token}`)
      .set("If-None-Match", `"${etag}"`)
      .expect(304);

    expect(cached.body).toEqual({});
  });

  it("denies cross-tenant connection and dashboard access", async () => {
    const alice = await register("s1-owner@example.com", "Owner");
    const bob = await register("s1-intruder@example.com", "Intruder");
    const org = await createOrg(alice.token, "Private Org");
    await createOrg(bob.token, "Bob Org");

    const connection = await request(server)
      .post(`/organizations/${org.id}/connections`)
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ name: "Privado" })
      .expect(201);

    await request(server)
      .get(`/organizations/${org.id}/connections`)
      .set("Authorization", `Bearer ${bob.token}`)
      .expect(403);

    await request(server)
      .post(`/organizations/${org.id}/connections/${connection.body.id}/sync`)
      .set("Authorization", `Bearer ${bob.token}`)
      .expect(403);

    await request(server)
      .get(`/organizations/${org.id}/dashboards`)
      .set("Authorization", `Bearer ${bob.token}`)
      .expect(403);

    const visible = await prisma.withOrganizationContext(
      (
        await request(server)
          .get("/organizations")
          .set("Authorization", `Bearer ${bob.token}`)
          .expect(200)
      ).body[0].id,
      (tx) => tx.connection.findMany(),
    );
    expect(visible.every((c) => c.organizationId !== org.id)).toBe(true);
  });

  it("RLS hides snapshots from other orgs", async () => {
    const alice = await register("s1-rls@example.com", "RLS");
    const orgA = await createOrg(alice.token, "RLS A");
    const orgB = await createOrg(alice.token, "RLS B");

    const connA = await request(server)
      .post(`/organizations/${orgA.id}/connections`)
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ name: "A mock" })
      .expect(201);

    await request(server)
      .post(`/organizations/${orgA.id}/connections/${connA.body.id}/sync`)
      .set("Authorization", `Bearer ${alice.token}`)
      .expect(201);

    const snapshotsA = await prisma.withOrganizationContext(orgA.id, (tx) =>
      tx.dataSnapshot.findMany(),
    );
    expect(snapshotsA).toHaveLength(1);

    const snapshotsB = await prisma.withOrganizationContext(orgB.id, (tx) =>
      tx.dataSnapshot.findMany(),
    );
    expect(snapshotsB).toHaveLength(0);
  });
});
