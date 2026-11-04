import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp, resetDatabase } from "./helpers/app";

describe("S8 platform console", () => {
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

  it("allows platform admin directory reads and denies tenant users", async () => {
    const ops = await request(server)
      .post("/auth/register")
      .send({
        email: "ops@example.com",
        password: "Password123!",
        name: "Ops",
      })
      .expect(201);
    await prisma.user.update({
      where: { id: ops.body.user.id },
      data: { isPlatformAdmin: true },
    });

    const tenant = await request(server)
      .post("/auth/register")
      .send({
        email: "tenant@example.com",
        password: "Password123!",
        name: "Tenant",
      })
      .expect(201);
    await request(server)
      .post("/organizations")
      .set("Authorization", `Bearer ${tenant.body.token}`)
      .send({ name: "Tenant Org" })
      .expect(201);

    await request(server)
      .get("/platform/overview")
      .set("Authorization", `Bearer ${tenant.body.token}`)
      .expect(403);

    const overview = await request(server)
      .get("/platform/overview")
      .set("Authorization", `Bearer ${ops.body.token}`)
      .expect(200);
    expect(overview.body.organizations).toBeGreaterThanOrEqual(1);
    expect(overview.body.users).toBeGreaterThanOrEqual(2);

    const orgs = await request(server)
      .get("/platform/organizations")
      .set("Authorization", `Bearer ${ops.body.token}`)
      .expect(200);
    expect(orgs.body.items.some((o: { name: string }) => o.name === "Tenant Org")).toBe(
      true,
    );
    expect(orgs.body.items[0]).not.toHaveProperty("snapshot");

    const health = await request(server)
      .get("/platform/health")
      .set("Authorization", `Bearer ${ops.body.token}`)
      .expect(200);
    expect(health.body.database).toBe("ok");
  });
});
