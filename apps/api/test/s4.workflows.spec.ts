import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp, resetDatabase } from "./helpers/app";

describe("S4 workflows", () => {
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

  async function bootstrap() {
    const alice = await request(server)
      .post("/auth/register")
      .send({
        email: "s4-alice@example.com",
        password: "Password123!",
        name: "Alice",
      })
      .expect(201);
    const org = await request(server)
      .post("/organizations")
      .set("Authorization", `Bearer ${alice.body.token}`)
      .send({ name: "Org WF", timezone: "America/Puerto_Rico" })
      .expect(201);
    const connection = await request(server)
      .post(`/organizations/${org.body.id}/connections`)
      .set("Authorization", `Bearer ${alice.body.token}`)
      .send({ name: "WF Mock" })
      .expect(201);
    await request(server)
      .post(
        `/organizations/${org.body.id}/connections/${connection.body.id}/sync`,
      )
      .set("Authorization", `Bearer ${alice.body.token}`)
      .set("Idempotency-Key", "s4-sync")
      .expect(201);
    return { token: alice.body.token as string, orgId: org.body.id as string };
  }

  it("dry-run succeeds with check_goal + notify + simulated approval", async () => {
    const { token, orgId } = await bootstrap();

    const wf = await request(server)
      .post(`/organizations/${orgId}/workflows`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Alerta de ventas",
        description: "Verifica meta y notifica",
        steps: [
          {
            key: "check_ventas",
            type: "check_goal",
            config: { metricKey: "ventas_dia", requireOnTrack: true },
          },
          {
            key: "notify_ops",
            type: "notify",
            config: { message: "Meta en curso" },
          },
          {
            key: "approve_close",
            type: "wait_approval",
            config: { prompt: "Cerrar ciclo?" },
          },
        ],
      })
      .expect(201);

    const run = await request(server)
      .post(`/organizations/${orgId}/workflows/${wf.body.id}/runs`)
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", "wf-dry-1")
      .send({ dryRun: true })
      .expect(201);

    expect(run.body.status).toBe("succeeded");
    expect(run.body.dryRun).toBe(true);

    const again = await request(server)
      .post(`/organizations/${orgId}/workflows/${wf.body.id}/runs`)
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", "wf-dry-1")
      .send({ dryRun: true })
      .expect(201);
    expect(again.body.id).toBe(run.body.id);

    const detail = await request(server)
      .get(`/organizations/${orgId}/workflow-runs/${run.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(detail.body.stepRuns).toHaveLength(3);
    expect(
      detail.body.stepRuns.every(
        (s: { status: string }) => s.status === "succeeded",
      ),
    ).toBe(true);
  });

  it("pauses for approval then continues after decide", async () => {
    const { token, orgId } = await bootstrap();

    const wf = await request(server)
      .post(`/organizations/${orgId}/workflows`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Con aprobación",
        steps: [
          {
            key: "notify_first",
            type: "notify",
            config: { message: "Inicio" },
          },
          {
            key: "need_human",
            type: "wait_approval",
            config: { prompt: "¿Continuar?" },
          },
          {
            key: "notify_done",
            type: "notify",
            config: { message: "Fin" },
          },
        ],
      })
      .expect(201);

    const run = await request(server)
      .post(`/organizations/${orgId}/workflows/${wf.body.id}/runs`)
      .set("Authorization", `Bearer ${token}`)
      .send({ dryRun: false })
      .expect(201);

    expect(run.body.status).toBe("waiting_approval");

    const approvals = await request(server)
      .get(`/organizations/${orgId}/approvals?status=pending`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(approvals.body).toHaveLength(1);

    await request(server)
      .post(
        `/organizations/${orgId}/approvals/${approvals.body[0].id}/decide`,
      )
      .set("Authorization", `Bearer ${token}`)
      .send({ decision: "approved", note: "OK" })
      .expect(201);

    const detail = await request(server)
      .get(`/organizations/${orgId}/workflow-runs/${run.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(detail.body.status).toBe("succeeded");
  });

  it("denies cross-tenant workflow access", async () => {
    const { token, orgId } = await bootstrap();
    const bob = await request(server)
      .post("/auth/register")
      .send({
        email: "s4-bob@example.com",
        password: "Password123!",
        name: "Bob",
      })
      .expect(201);
    await request(server)
      .post("/organizations")
      .set("Authorization", `Bearer ${bob.body.token}`)
      .send({ name: "Bob Org" })
      .expect(201);

    const wf = await request(server)
      .post(`/organizations/${orgId}/workflows`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Privado",
        steps: [{ key: "n1", type: "notify", config: {} }],
      })
      .expect(201);

    await request(server)
      .get(`/organizations/${orgId}/workflows`)
      .set("Authorization", `Bearer ${bob.body.token}`)
      .expect(403);

    await request(server)
      .post(`/organizations/${orgId}/workflows/${wf.body.id}/runs`)
      .set("Authorization", `Bearer ${bob.body.token}`)
      .send({})
      .expect(403);

    const bobOrgId = (
      await request(server)
        .get("/organizations")
        .set("Authorization", `Bearer ${bob.body.token}`)
        .expect(200)
    ).body[0].id as string;

    const hidden = await prisma.withOrganizationContext(bobOrgId, (tx) =>
      tx.workflowDefinition.findMany(),
    );
    expect(hidden.every((w) => w.organizationId !== orgId)).toBe(true);
  });
});
