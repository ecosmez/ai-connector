import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp, resetDatabase } from "./helpers/app";

describe("S10 SCIM user provisioning", () => {
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

  it("mints token, provisions user, deactivates via PATCH/DELETE", async () => {
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
      .send({ name: "SCIM Org" })
      .expect(201);

    const minted = await request(server)
      .post(`/organizations/${org.body.id}/scim/tokens`)
      .set("Authorization", `Bearer ${owner.body.token}`)
      .send({ name: "Test IdP" })
      .expect(201);

    expect(minted.body.token).toMatch(/^scim_/);
    const scimToken = minted.body.token as string;

    await request(server).get("/scim/v2/Users").expect(401);

    const created = await request(server)
      .post("/scim/v2/Users")
      .set("Authorization", `Bearer ${scimToken}`)
      .send({
        schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
        userName: "prov@example.com",
        displayName: "Prov User",
        active: true,
        emails: [{ value: "prov@example.com", primary: true }],
      })
      .expect(201);

    expect(created.body.id).toBeTruthy();
    expect(created.body.active).toBe(true);
    expect(created.body.userName).toBe("prov@example.com");

    const listed = await request(server)
      .get("/scim/v2/Users")
      .set("Authorization", `Bearer ${scimToken}`)
      .query({ filter: 'userName eq "prov@example.com"' })
      .expect(200);
    expect(listed.body.totalResults).toBe(1);

    await request(server)
      .patch(`/scim/v2/Users/${created.body.id}`)
      .set("Authorization", `Bearer ${scimToken}`)
      .send({
        schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
        Operations: [{ op: "Replace", path: "active", value: false }],
      })
      .expect(200);

    const membership = await prisma.membership.findFirst({
      where: { organizationId: org.body.id, userId: created.body.id },
    });
    expect(membership?.status).toBe("suspended");

    // Reactivate then soft-delete
    await request(server)
      .patch(`/scim/v2/Users/${created.body.id}`)
      .set("Authorization", `Bearer ${scimToken}`)
      .send({
        Operations: [{ op: "Replace", path: "active", value: true }],
      })
      .expect(200);

    await request(server)
      .delete(`/scim/v2/Users/${created.body.id}`)
      .set("Authorization", `Bearer ${scimToken}`)
      .expect(204);

    const afterDelete = await prisma.membership.findFirst({
      where: { organizationId: org.body.id, userId: created.body.id },
    });
    expect(afterDelete?.status).toBe("suspended");

    await request(server)
      .post(`/organizations/${org.body.id}/scim/tokens/${minted.body.id}/revoke`)
      .set("Authorization", `Bearer ${owner.body.token}`)
      .send({})
      .expect(201);

    await request(server)
      .get("/scim/v2/Users")
      .set("Authorization", `Bearer ${scimToken}`)
      .expect(401);
  });
});
