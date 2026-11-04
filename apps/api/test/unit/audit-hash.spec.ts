import { describe, expect, it } from "vitest";
import {
  AUDIT_GENESIS_HASH,
  computeEventHash,
  verifyEventChain,
} from "../../src/audit/audit-hash";

describe("audit hash chain", () => {
  it("links events and detects tampering", () => {
    const t0 = new Date("2026-11-03T00:00:00.000Z");
    const t1 = new Date("2026-11-03T00:00:01.000Z");
    const e0 = {
      id: "e0",
      organizationId: "org1",
      actorUserId: "u1",
      action: "user.login",
      resourceType: "user",
      resourceId: "u1",
      metadata: null as null,
      createdAt: t0,
      prevHash: AUDIT_GENESIS_HASH,
      eventHash: "",
    };
    e0.eventHash = computeEventHash(e0);

    const e1 = {
      id: "e1",
      organizationId: "org1",
      actorUserId: "u1",
      action: "organization.created",
      resourceType: "organization",
      resourceId: "org1",
      metadata: { name: "Acme" } as { name: string },
      createdAt: t1,
      prevHash: e0.eventHash,
      eventHash: "",
    };
    e1.eventHash = computeEventHash(e1);

    expect(verifyEventChain([e0, e1]).valid).toBe(true);

    const tampered = { ...e1, action: "organization.deleted" };
    expect(verifyEventChain([e0, tampered]).valid).toBe(false);
  });
});
