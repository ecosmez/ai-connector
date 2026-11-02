import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /** Sets Postgres GUC used by RLS policies for the current transaction. */
  async withOrganizationContext<T>(
    organizationId: string | null,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      const orgKey = organizationId ?? "";
      await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgKey}, true)`;
      return fn(tx);
    });
  }
}
