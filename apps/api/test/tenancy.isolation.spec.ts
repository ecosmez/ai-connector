import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp, resetDatabase } from "./helpers/app";

describe("tenancy isolation (S0)", () => {
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
    return res.body as { token: string; user: { id: string; email: string } };
  }

  it("health is public", async () => {
    const res = await request(server).get("/health").expect(200);
    expect(res.body.status).toBe("ok");
  });

  it("user with roles in two orgs only sees authorized org data per context", async () => {
    const alice = await register("alice@example.com", "Alice");

    const orgA = await request(server)
      .post("/organizations")
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ name: "Org A", timezone: "America/Puerto_Rico" })
      .expect(201);

    const orgB = await request(server)
      .post("/organizations")
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ name: "Org B", timezone: "America/New_York" })
      .expect(201);

    await request(server)
      .post(`/organizations/${orgA.body.id}/companies`)
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ name: "Company A1" })
      .expect(201);

    await request(server)
      .post(`/organizations/${orgB.body.id}/companies`)
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ name: "Company B1" })
      .expect(201);

    await request(server)
      .post("/sessions/context")
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ organizationId: orgA.body.id })
      .expect(201);

    const companiesA = await request(server)
      .get(`/organizations/${orgA.body.id}/companies`)
      .set("Authorization", `Bearer ${alice.token}`)
      .expect(200);

    expect(companiesA.body.map((c: { name: string }) => c.name)).toEqual([
      "Company A1",
    ]);

    await request(server)
      .post("/sessions/context")
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ organizationId: orgB.body.id })
      .expect(201);

    const companiesB = await request(server)
      .get(`/organizations/${orgB.body.id}/companies`)
      .set("Authorization", `Bearer ${alice.token}`)
      .expect(200);

    expect(companiesB.body.map((c: { name: string }) => c.name)).toEqual([
      "Company B1",
    ]);
  });

  it("direct access to another organization by id is denied", async () => {
    const alice = await register("alice2@example.com", "Alice");
    const bob = await register("bob@example.com", "Bob");

    const orgA = await request(server)
      .post("/organizations")
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ name: "Alice Org" })
      .expect(201);

    await request(server)
      .get(`/organizations/${orgA.body.id}`)
      .set("Authorization", `Bearer ${bob.token}`)
      .expect(403);

    await request(server)
      .get(`/organizations/${orgA.body.id}/companies`)
      .set("Authorization", `Bearer ${bob.token}`)
      .expect(403);

    await request(server)
      .get(`/organizations/${orgA.body.id}/audit-events`)
      .set("Authorization", `Bearer ${bob.token}`)
      .expect(403);
  });

  it("company admin cannot create companies without company:create (org-only permission)", async () => {
    const owner = await register("owner@example.com", "Owner");
    const admin = await register("cadm@example.com", "Company Admin");

    const org = await request(server)
      .post("/organizations")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "Dealer Group" })
      .expect(201);

    const company = await request(server)
      .post(`/organizations/${org.body.id}/companies`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "Norte" })
      .expect(201);

    // Seed a company_admin role binding for admin without COMPANY_CREATE... 
    // COMPANY_ADMIN_PERMISSIONS does not include company:create.
    const { COMPANY_ADMIN_PERMISSIONS } = await import("@ai-connector/shared");
    const role = await prisma.role.create({
      data: {
        organizationId: org.body.id,
        key: "company_admin",
        name: "Administrador de compañía",
        isSystem: true,
      },
    });
    for (const key of COMPANY_ADMIN_PERMISSIONS) {
      const permission = await prisma.permission.upsert({
        where: { key },
        create: { key },
        update: {},
      });
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId: permission.id },
      });
    }
    await prisma.membership.create({
      data: {
        organizationId: org.body.id,
        companyId: company.body.id,
        userId: admin.user.id,
      },
    });
    await prisma.roleBinding.create({
      data: {
        organizationId: org.body.id,
        companyId: company.body.id,
        userId: admin.user.id,
        roleId: role.id,
      },
    });

    await request(server)
      .post(`/organizations/${org.body.id}/companies`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "Should Fail" })
      .expect(403);
  });

  it("revoking a session blocks subsequent authenticated calls", async () => {
    const user = await register("revoke@example.com", "Revoke");
    await request(server)
      .post("/auth/logout")
      .set("Authorization", `Bearer ${user.token}`)
      .expect(201);

    await request(server)
      .get("/auth/me")
      .set("Authorization", `Bearer ${user.token}`)
      .expect(401);
  });

  it("sensitive mutations emit audit events without secrets", async () => {
    const user = await register("audit@example.com", "Audit");
    const org = await request(server)
      .post("/organizations")
      .set("Authorization", `Bearer ${user.token}`)
      .send({ name: "Audit Org" })
      .expect(201);

    const events = await request(server)
      .get(`/organizations/${org.body.id}/audit-events`)
      .set("Authorization", `Bearer ${user.token}`)
      .expect(200);

    expect(events.body.items.length).toBeGreaterThan(0);
    const created = events.body.items.find(
      (e: { action: string }) => e.action === "organization.created",
    );
    expect(created).toBeTruthy();
    const serialized = JSON.stringify(events.body.items);
    expect(serialized.toLowerCase()).not.toContain("password");
    expect(serialized.toLowerCase()).not.toContain("passwordhash");
  });

  it("RLS hides companies from other orgs inside a scoped transaction", async () => {
    const alice = await register("rls@example.com", "RLS");
    const orgA = await request(server)
      .post("/organizations")
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ name: "RLS A" })
      .expect(201);
    const orgB = await request(server)
      .post("/organizations")
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ name: "RLS B" })
      .expect(201);

    await request(server)
      .post(`/organizations/${orgA.body.id}/companies`)
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ name: "Only A" })
      .expect(201);
    await request(server)
      .post(`/organizations/${orgB.body.id}/companies`)
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ name: "Only B" })
      .expect(201);

    const visible = await prisma.withOrganizationContext(
      orgA.body.id,
      (tx) => tx.company.findMany(),
    );
    expect(visible.every((c) => c.organizationId === orgA.body.id)).toBe(true);
    expect(visible.map((c) => c.name)).toEqual(["Only A"]);
  });
});
