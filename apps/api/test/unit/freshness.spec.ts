import { describe, expect, it } from "vitest";
import {
  computeFreshness,
  freshnessLabelEs,
} from "../../src/dashboards/freshness";

describe("computeFreshness", () => {
  const now = new Date("2026-11-02T18:00:00.000Z");

  it("returns never when never synced", () => {
    expect(computeFreshness(null, 26, now)).toBe("never");
    expect(freshnessLabelEs("never")).toBe("Sin sincronizar");
  });

  it("returns fresh within stale window", () => {
    const last = new Date("2026-11-02T10:00:00.000Z");
    expect(computeFreshness(last, 26, now)).toBe("fresh");
    expect(freshnessLabelEs("fresh")).toBe("Fresco");
  });

  it("returns stale after threshold", () => {
    const last = new Date("2026-10-31T10:00:00.000Z");
    expect(computeFreshness(last, 26, now)).toBe("stale");
    expect(freshnessLabelEs("stale")).toBe("Obsoleto");
  });
});
