import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaService } from "../src/prisma/prisma.service";
import { WorkflowsService } from "../src/workflows/workflows.service";
import { createTestApp, resetDatabase } from "./helpers/app";

describe("S5 notifications + scheduled workflows", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let workflowsService: WorkflowsService;
  let server: Parameters<typeof request>[0];

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    workflowsService = app.get(WorkflowsService);
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
        email: "s5-alice@example.com",
        password: "Password123!",
        name: "Alice",
      })
      .expect(201);
    const org = await request(server)
      .post("/organizations")
      .set("Authorization", `Bearer ${alice.body.token}`)
      .send({ name: "Org Notify", timezone: "America/Puerto_Rico" })
      .expect(201);
    const connection = await request(server)
      .post(`/organizations/${org.body.id}/connections`)
      .set("Authorization", `Bearer ${alice.body.token}`)
      .send({ name: "Notify Mock" })
      .expect(201);
    await request(server)
      .post(
        `/organizations/${org.body.id}/connections/${connection.body.id}/sync`,
      )
      .set("Authorization", `Bearer ${alice.body.token}`)
      .set("Idempotency-Key", "s5-sync")
      .expect(201);
    return { token: alice.body.token as string, orgId: org.body.id as string };
  }

  it("real notify creates an in-app notification; dry-run does not", async () => {
    const { token, orgId } = await bootstrap();

    const wf = await request(server)
      .post(`/organizations/${orgId}/workflows`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Solo notify",
        steps: [
          {
            key: "notify_ops",
            type: "notify",
            config: {
              title: "Alerta S5",
              message: "Meta verificada",
              channel: "in_app",
            },
          },
        ],
      })
      .expect(201);

    await request(server)
      .post(`/organizations/${orgId}/workflows/${wf.body.id}/runs`)
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", "s5-dry")
      .send({ dryRun: true })
      .expect(201);

    const empty = await request(server)
      .get(`/organizations/${orgId}/notifications`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(empty.body).toHaveLength(0);

    const run = await request(server)
      .post(`/organizations/${orgId}/workflows/${wf.body.id}/runs`)
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", "s5-real")
      .send({ dryRun: false })
      .expect(201);
    expect(run.body.status).toBe("succeeded");

    const list = await request(server)
      .get(`/organizations/${orgId}/notifications`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].title).toBe("Alerta S5");
    expect(list.body[0].body).toBe("Meta verificada");
    expect(list.body[0].readAt).toBeNull();

    const marked = await request(server)
      .post(
        `/organizations/${orgId}/notifications/${list.body[0].id}/read`,
      )
      .set("Authorization", `Bearer ${token}`)
      .expect(201);
    expect(marked.body.readAt).toBeTruthy();
  });

  it("schedule update persists cron and scheduled tick starts a run", async () => {
    const { token, orgId } = await bootstrap();

    const wf = await request(server)
      .post(`/organizations/${orgId}/workflows`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Programada",
        steps: [
          {
            key: "notify_ops",
            type: "notify",
            config: { message: "Tick programado", channel: "in_app" },
          },
        ],
      })
      .expect(201);

    const scheduled = await request(server)
      .post(`/organizations/${orgId}/workflows/${wf.body.id}/schedule`)
      .set("Authorization", `Bearer ${token}`)
      .send({ enabled: true, cron: "0 8 * * *", timezone: "America/Puerto_Rico" })
      .expect(201);

    expect(scheduled.body.scheduleEnabled).toBe(true);
    expect(scheduled.body.scheduleCron).toBe("0 8 * * *");

    const run = await workflowsService.handleScheduledTick(orgId, wf.body.id);
    expect(run).toBeTruthy();
    expect(run!.status).toBe("succeeded");
    expect(run!.dryRun).toBe(false);

    const notifications = await request(server)
      .get(`/organizations/${orgId}/notifications?unreadOnly=true`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(notifications.body.length).toBeGreaterThanOrEqual(1);
  });

  it("denies cross-tenant notification access", async () => {
    const a = await bootstrap();
    const bob = await request(server)
      .post("/auth/register")
      .send({
        email: "s5-bob@example.com",
        password: "Password123!",
        name: "Bob",
      })
      .expect(201);
    const otherOrg = await request(server)
      .post("/organizations")
      .set("Authorization", `Bearer ${bob.body.token}`)
      .send({ name: "Other Org" })
      .expect(201);

    const wf = await request(server)
      .post(`/organizations/${a.orgId}/workflows`)
      .set("Authorization", `Bearer ${a.token}`)
      .send({
        name: "Privada",
        steps: [
          {
            key: "n1",
            type: "notify",
            config: { message: "secreto", channel: "in_app" },
          },
        ],
      })
      .expect(201);
    await request(server)
      .post(`/organizations/${a.orgId}/workflows/${wf.body.id}/runs`)
      .set("Authorization", `Bearer ${a.token}`)
      .send({ dryRun: false })
      .expect(201);

    await request(server)
      .get(`/organizations/${a.orgId}/notifications`)
      .set("Authorization", `Bearer ${bob.body.token}`)
      .expect(403);

    await request(server)
      .post(`/organizations/${otherOrg.body.id}/workflows/${wf.body.id}/schedule`)
      .set("Authorization", `Bearer ${bob.body.token}`)
      .send({ enabled: true, cron: "0 9 * * *" })
      .expect(404);
  });
});
