import { describe, expect, it } from "vitest";
import { PERMISSIONS } from "@ai-connector/shared";

describe("permission catalog", () => {
  it("includes multi-company workflow only for elevated roles catalog", () => {
    expect(PERMISSIONS.WORKFLOW_MULTI_COMPANY).toBe("workflow:multi_company");
    expect(PERMISSIONS.COMPANY_CREATE).toBe("company:create");
  });
});
