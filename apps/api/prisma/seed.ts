import {
  COMPANY_ADMIN_PERMISSIONS,
  ORG_OWNER_PERMISSIONS,
  PERMISSIONS,
} from "@ai-connector/shared";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { MOCK_METRIC_BOOTSTRAP } from "../src/semantic/kpi-resolve";

const prisma = new PrismaClient();

async function ensurePermissions() {
  const keys = Object.values(PERMISSIONS);
  for (const key of keys) {
    await prisma.permission.upsert({
      where: { key },
      create: { key },
      update: {},
    });
  }
}

async function main() {
  // Ensure bootstrap path is unrestricted under RLS.
  await prisma.$executeRaw`SELECT set_config('app.current_org_id', '', false)`;
  await ensurePermissions();

  const passwordHash = await bcrypt.hash("Password123!", 10);

  const alice = await prisma.user.upsert({
    where: { email: "alice@example.com" },
    create: {
      email: "alice@example.com",
      name: "Alice Owner",
      passwordHash,
    },
    update: {},
  });

  const bob = await prisma.user.upsert({
    where: { email: "bob@example.com" },
    create: {
      email: "bob@example.com",
      name: "Bob Company Admin",
      passwordHash,
    },
    update: {},
  });

  const orgA = await prisma.organization.upsert({
    where: { id: "seed_org_a" },
    create: {
      id: "seed_org_a",
      name: "Org Alpha",
      timezone: "America/Puerto_Rico",
    },
    update: { name: "Org Alpha" },
  });

  const orgB = await prisma.organization.upsert({
    where: { id: "seed_org_b" },
    create: {
      id: "seed_org_b",
      name: "Org Beta",
      timezone: "America/New_York",
    },
    update: { name: "Org Beta" },
  });

  const companyA1 = await prisma.company.upsert({
    where: {
      organizationId_name: { organizationId: orgA.id, name: "Concesionario Norte" },
    },
    create: {
      id: "seed_company_a1",
      organizationId: orgA.id,
      name: "Concesionario Norte",
      timezone: "America/Puerto_Rico",
    },
    update: {},
  });

  const companyA2 = await prisma.company.upsert({
    where: {
      organizationId_name: { organizationId: orgA.id, name: "Concesionario Sur" },
    },
    create: {
      id: "seed_company_a2",
      organizationId: orgA.id,
      name: "Concesionario Sur",
    },
    update: {},
  });

  await prisma.company.upsert({
    where: {
      organizationId_name: { organizationId: orgB.id, name: "Beta Motors" },
    },
    create: {
      id: "seed_company_b1",
      organizationId: orgB.id,
      name: "Beta Motors",
    },
    update: {},
  });

  async function ensureRole(
    organizationId: string,
    key: string,
    name: string,
    permissionKeys: string[],
  ) {
    const role = await prisma.role.upsert({
      where: { organizationId_key: { organizationId, key } },
      create: { organizationId, key, name, isSystem: true },
      update: { name },
    });
    for (const permissionKey of permissionKeys) {
      const permission = await prisma.permission.findUniqueOrThrow({
        where: { key: permissionKey },
      });
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: permission.id },
        },
        create: { roleId: role.id, permissionId: permission.id },
        update: {},
      });
    }
    return role;
  }

  const ownerRoleA = await ensureRole(
    orgA.id,
    "org_owner",
    "Propietario de organización",
    ORG_OWNER_PERMISSIONS,
  );
  const companyAdminA = await ensureRole(
    orgA.id,
    "company_admin",
    "Administrador de compañía",
    COMPANY_ADMIN_PERMISSIONS,
  );
  const ownerRoleB = await ensureRole(
    orgB.id,
    "org_owner",
    "Propietario de organización",
    ORG_OWNER_PERMISSIONS,
  );

  await prisma.membership.deleteMany({
    where: { userId: { in: [alice.id, bob.id] } },
  });
  await prisma.roleBinding.deleteMany({
    where: { userId: { in: [alice.id, bob.id] } },
  });

  await prisma.membership.create({
    data: { organizationId: orgA.id, userId: alice.id },
  });
  await prisma.membership.create({
    data: { organizationId: orgB.id, userId: alice.id },
  });
  await prisma.membership.create({
    data: {
      organizationId: orgA.id,
      companyId: companyA1.id,
      userId: bob.id,
    },
  });

  await prisma.roleBinding.create({
    data: {
      organizationId: orgA.id,
      userId: alice.id,
      roleId: ownerRoleA.id,
    },
  });
  await prisma.roleBinding.create({
    data: {
      organizationId: orgB.id,
      userId: alice.id,
      roleId: ownerRoleB.id,
    },
  });
  await prisma.roleBinding.create({
    data: {
      organizationId: orgA.id,
      companyId: companyA1.id,
      userId: bob.id,
      roleId: companyAdminA.id,
    },
  });

  await prisma.$executeRaw`SELECT set_config('app.current_org_id', ${orgA.id}, false)`;

  const connection = await prisma.connection.upsert({
    where: { id: "seed_connection_a1" },
    create: {
      id: "seed_connection_a1",
      organizationId: orgA.id,
      companyId: companyA1.id,
      name: "Conector de prueba — Norte",
      provider: "mock",
      status: "active",
      config: { kind: "mock", locale: "es" },
    },
    update: { name: "Conector de prueba — Norte", status: "active" },
  });

  await prisma.dashboard.upsert({
    where: { id: "seed_dashboard_a1" },
    create: {
      id: "seed_dashboard_a1",
      organizationId: orgA.id,
      companyId: companyA1.id,
      connectionId: connection.id,
      name: "Panel de frescura",
      staleAfterHours: 26,
    },
    update: { name: "Panel de frescura" },
  });

  const semanticModel = await prisma.semanticModel.upsert({
    where: { connectionId: connection.id },
    create: {
      id: "seed_semantic_a1",
      organizationId: orgA.id,
      connectionId: connection.id,
      name: "Modelo · Conector de prueba — Norte",
      status: "active",
    },
    update: { name: "Modelo · Conector de prueba — Norte", status: "active" },
  });

  for (const metric of MOCK_METRIC_BOOTSTRAP) {
    await prisma.metricDefinition.upsert({
      where: {
        semanticModelId_key: {
          semanticModelId: semanticModel.id,
          key: metric.key,
        },
      },
      create: {
        organizationId: orgA.id,
        semanticModelId: semanticModel.id,
        key: metric.key,
        label: metric.label,
        sourcePath: metric.sourcePath,
        aggregation: metric.aggregation ?? "latest",
        unit: metric.unit,
        format: metric.format,
        sortOrder: metric.sortOrder,
      },
      update: {
        label: metric.label,
        sourcePath: metric.sourcePath,
        aggregation: metric.aggregation ?? "latest",
        unit: metric.unit,
        format: metric.format,
        sortOrder: metric.sortOrder,
      },
    });
  }

  await prisma.goal.upsert({
    where: { id: "seed_goal_ventas_a1" },
    create: {
      id: "seed_goal_ventas_a1",
      organizationId: orgA.id,
      companyId: companyA1.id,
      dashboardId: "seed_dashboard_a1",
      metricKey: "ventas_dia",
      name: "Meta de ventas diarias",
      targetValue: 15,
      comparator: "gte",
      status: "active",
    },
    update: {
      name: "Meta de ventas diarias",
      targetValue: 15,
      status: "active",
    },
  });

  await prisma.workflowDefinition.upsert({
    where: {
      organizationId_name: {
        organizationId: orgA.id,
        name: "Alerta de ventas",
      },
    },
    create: {
      id: "seed_workflow_ventas_a1",
      organizationId: orgA.id,
      companyId: companyA1.id,
      name: "Alerta de ventas",
      description: "check_goal → notify → wait_approval",
      status: "active",
      steps: [
        {
          key: "check_ventas",
          type: "check_goal",
          config: { metricKey: "ventas_dia", requireOnTrack: true },
        },
        {
          key: "notify_ops",
          type: "notify",
          config: { message: "Meta de ventas en curso" },
        },
        {
          key: "approve_close",
          type: "wait_approval",
          config: { prompt: "¿Cerrar el ciclo?" },
        },
      ],
    },
    update: {
      description: "check_goal → notify → wait_approval",
      status: "active",
    },
  });

  await prisma.$executeRaw`SELECT set_config('app.current_org_id', '', false)`;

  console.log("Seed complete:", {
    alice: alice.email,
    bob: bob.email,
    orgs: [orgA.name, orgB.name],
    companies: [companyA1.name, companyA2.name],
    connection: connection.name,
    semanticModel: semanticModel.name,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
