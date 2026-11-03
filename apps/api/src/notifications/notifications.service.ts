import { HttpStatus, Injectable } from "@nestjs/common";
import { PERMISSIONS } from "@ai-connector/shared";
import { ApiException } from "../common/errors";
import { PolicyService } from "../policy/policy.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policyService: PolicyService,
  ) {}

  async list(
    userId: string,
    organizationId: string,
    options?: { unreadOnly?: boolean },
  ) {
    await this.policyService.assertPermission(
      userId,
      organizationId,
      PERMISSIONS.NOTIFICATION_READ,
    );

    return this.prisma.withOrganizationContext(organizationId, (tx) =>
      tx.notification.findMany({
        where: {
          organizationId,
          OR: [{ recipientUserId: null }, { recipientUserId: userId }],
          ...(options?.unreadOnly ? { readAt: null } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    );
  }

  async markRead(
    userId: string,
    organizationId: string,
    notificationId: string,
  ) {
    await this.policyService.assertPermission(
      userId,
      organizationId,
      PERMISSIONS.NOTIFICATION_READ,
    );

    const updated = await this.prisma.withOrganizationContext(
      organizationId,
      async (tx) => {
        const existing = await tx.notification.findFirst({
          where: {
            id: notificationId,
            organizationId,
            OR: [{ recipientUserId: null }, { recipientUserId: userId }],
          },
        });
        if (!existing) return null;
        if (existing.readAt) return existing;
        return tx.notification.update({
          where: { id: existing.id },
          data: { readAt: new Date() },
        });
      },
    );

    if (!updated) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        "notification_not_found",
        "Notificación no encontrada",
      );
    }
    return updated;
  }

  /** Internal helper used by workflow notify steps (no auth). */
  async createInApp(input: {
    organizationId: string;
    title: string;
    body: string;
    sourceType?: string;
    sourceId?: string;
    recipientUserId?: string | null;
  }) {
    return this.prisma.withOrganizationContext(input.organizationId, (tx) =>
      tx.notification.create({
        data: {
          organizationId: input.organizationId,
          recipientUserId: input.recipientUserId ?? null,
          title: input.title,
          body: input.body,
          channel: "in_app",
          sourceType: input.sourceType ?? null,
          sourceId: input.sourceId ?? null,
        },
      }),
    );
  }
}
