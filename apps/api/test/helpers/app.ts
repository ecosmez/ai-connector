import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/prisma/prisma.service";

export async function createTestApp(): Promise<{
  app: INestApplication;
  prisma: PrismaService;
}> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  const prisma = app.get(PrismaService);
  return { app, prisma };
}

export async function resetDatabase(prisma: PrismaService) {
  await prisma.$executeRawUnsafe(
    `SELECT set_config('app.current_org_id', '', true)`,
  );
  // Order matters for FKs; truncate all tenant tables.
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "ApprovalRequest",
      "WorkflowStepRun",
      "WorkflowRun",
      "WorkflowDefinition",
      "AssistantMessage",
      "AssistantThread",
      "Goal",
      "MetricDefinition",
      "SemanticModel",
      "DataSnapshot",
      "SyncRun",
      "Dashboard",
      "Connection",
      "AuditEvent",
      "Session",
      "RoleBinding",
      "RolePermission",
      "Membership",
      "Company",
      "Role",
      "Permission",
      "Organization",
      "User"
    RESTART IDENTITY CASCADE;
  `);
}
