import { describe, expect, it } from "vitest";
import { IMPORT_COLUMNS, STANDARD_CLASSES, validateRows, type RawRow } from "../student-import";

function raw(values: Partial<Record<(typeof IMPORT_COLUMNS)[number], string>>): RawRow {
  const base = Object.fromEntries(IMPORT_COLUMNS.map((c) => [c, ""])) as RawRow["values"];
  return {
    rowNumber: 2,
    values: { ...base, "GR Number": "202600999", "Student Name": "Test Child", "Parent Name": "P", "Parent Phone Number": "9876543210", ...values },
  };
}
const ctx = { existingByGr: {}, allowedClassKeys: ["class 5|a"], targetClass: { name: "Class 5", division: "A" } };

describe("Manage Class import", () => {
  it("offers exactly Class 1 to Class 10", () => {
    expect(STANDARD_CLASSES).toHaveLength(10);
    expect(STANDARD_CLASSES[0]).toBe("Class 1");
    expect(STANDARD_CLASSES[9]).toBe("Class 10");
  });
  it("fills blank class and division from the chosen class", () => {
    const [r] = validateRows([raw({})], ctx);
    expect(r!.action).toBe("create");
    expect(r!.row.className).toBe("Class 5");
    expect(r!.row.division).toBe("A");
  });
  it("rejects a row for another class", () => {
    const [r] = validateRows([raw({ Class: "Class 6", Division: "A" })], ctx);
    expect(r!.action).toBe("error");
  });
  it("rejects a row for another division of the same class", () => {
    const [r] = validateRows([raw({ Class: "Class 5", Division: "B" })], ctx);
    expect(r!.action).toBe("error");
  });
  it("rejects invalid division labels", () => {
    const [r] = validateRows([raw({ Class: "Class 5", Division: "A!" })], { ...ctx, targetClass: null, allowedClassKeys: null });
    expect(r!.action).toBe("error");
  });
});
