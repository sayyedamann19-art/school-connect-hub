import { describe, expect, it } from "vitest";
import { normalizeCategory } from "../updates.functions";

describe("update categories", () => {
  it("keeps holiday", () => expect(normalizeCategory("holiday")).toBe("holiday"));
  it("shows old school/attendance/feedback updates as notice", () => {
    for (const old of ["school", "attendance", "feedback"]) expect(normalizeCategory(old)).toBe("notice");
  });
});
