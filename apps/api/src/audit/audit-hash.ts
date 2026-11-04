import { createHash } from "crypto";
import { Prisma } from "@prisma/client";

export const AUDIT_GENESIS_HASH = "0".repeat(64);

export type AuditHashPayload = {
  prevHash: string;
  organizationId: string | null;
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  id: string;
};

/** Stable JSON: sorted object keys, no whitespace variance. */
export function canonicalizeMetadata(
  metadata: Prisma.JsonValue | null | undefined,
): string {
  if (metadata === null || metadata === undefined) return "null";
  return JSON.stringify(sortJson(metadata));
}

function sortJson(value: Prisma.JsonValue): Prisma.JsonValue {
  if (Array.isArray(value)) {
    return value.map((v) =>
      v === null || typeof v !== "object" ? v : sortJson(v as Prisma.JsonValue),
    );
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, Prisma.JsonValue> = {};
    for (const key of Object.keys(value as object).sort()) {
      const v = (value as Record<string, Prisma.JsonValue>)[key];
      out[key] =
        v !== null && typeof v === "object" ? sortJson(v) : (v as Prisma.JsonValue);
    }
    return out;
  }
  return value;
}

export function computeEventHash(payload: AuditHashPayload): string {
  const material = [
    payload.prevHash,
    payload.id,
    payload.organizationId ?? "",
    payload.actorUserId ?? "",
    payload.action,
    payload.resourceType,
    payload.resourceId ?? "",
    canonicalizeMetadata(payload.metadata),
    payload.createdAt.toISOString(),
  ].join("|");
  return createHash("sha256").update(material, "utf8").digest("hex");
}

export function verifyEventChain(
  eventsOldestFirst: Array<{
    id: string;
    organizationId: string | null;
    actorUserId: string | null;
    action: string;
    resourceType: string;
    resourceId: string | null;
    metadata: Prisma.JsonValue | null;
    prevHash: string | null;
    eventHash: string | null;
    createdAt: Date;
  }>,
): { valid: boolean; checked: number; firstInvalidId: string | null } {
  let expectedPrev = AUDIT_GENESIS_HASH;
  let started = false;
  let checked = 0;
  for (const ev of eventsOldestFirst) {
    if (!ev.eventHash || !ev.prevHash) {
      // Pre-S7 legacy rows — skip until first hashed event.
      if (!started) continue;
      return { valid: false, checked, firstInvalidId: ev.id };
    }
    started = true;
    if (ev.prevHash !== expectedPrev) {
      return { valid: false, checked, firstInvalidId: ev.id };
    }
    const recomputed = computeEventHash({
      prevHash: ev.prevHash,
      id: ev.id,
      organizationId: ev.organizationId,
      actorUserId: ev.actorUserId,
      action: ev.action,
      resourceType: ev.resourceType,
      resourceId: ev.resourceId,
      metadata: ev.metadata,
      createdAt: ev.createdAt,
    });
    checked += 1;
    if (recomputed !== ev.eventHash) {
      return { valid: false, checked, firstInvalidId: ev.id };
    }
    expectedPrev = ev.eventHash;
  }
  return { valid: true, checked, firstInvalidId: null };
}
