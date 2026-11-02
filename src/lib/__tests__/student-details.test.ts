import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  normaliseBirthDate,
  requiredStudentDetails,
  schoolToday,
  studentAge,
  validBirthDate,
} from "../student-details";
import { IMPORT_COLUMNS, validateRows, type RawRow } from "../student-import";

const details = {
  rollNumber: "007",
  dateOfBirth: "2017-05-12",
  motherName: "Mother A",
  address: "12 College Road, Nashik",
  contactNumber: "9876543210",
};
const values = Object.fromEntries(IMPORT_COLUMNS.map((c) => [c, ""])) as RawRow["values"];
function row(overrides: Partial<RawRow["values"]> = {}): RawRow {
  return {
    rowNumber: 3,
    values: {
      ...values,
      "Roll Number": "007",
      "GR Number": "GR-100",
      "Student Name": "Child A",
      "Date of Birth": "2017-05-12",
      "Mother’s Name": "Mother A",
      Address: "Nashik",
      "Contact Number": "9876543210",
      Class: "Class 5",
      Division: "A",
      "Parent Name": "Guardian A",
      "Parent Phone Number": "9123456780",
      ...overrides,
    },
  };
}
const context = { existingByGr: {}, allowedClassKeys: ["class 5|a"] };

describe("student registration details", () => {
  it("computes completed age before, on and after a birthday", () => {
    expect(studentAge(details.dateOfBirth, "2026-05-11")).toBe(8);
    expect(studentAge(details.dateOfBirth, "2026-05-12")).toBe(9);
    expect(studentAge(details.dateOfBirth, "2026-05-13")).toBe(9);
  });
  it("handles leap day dates and rejects missing, impossible or future DOB", () => {
    expect(validBirthDate("2024-02-29", "2026-01-01")).toBe(true);
    for (const dob of ["2023-02-29", "2017-04-31", "0000-01-01", "2026-12-01", "bad", ""]) {
      expect(studentAge(dob, "2026-11-03")).toBeNull();
    }
    expect(studentAge("2020-02-29", "2026-02-28")).toBe(5);
    expect(studentAge("2020-02-29", "2026-03-01")).toBe(6);
  });
  it("uses India's date at UTC midnight boundaries", () => {
    expect(schoolToday(new Date("2026-11-02T20:00:00Z"))).toBe("2026-11-03");
  });
  it("normalizes supported DOB text formats", () => {
    expect(normaliseBirthDate("12/05/2017")).toBe("2017-05-12");
    expect(normaliseBirthDate("2017-05-12")).toBe("2017-05-12");
  });
  it.each(Object.keys(details))("requires %s for new registrations", (key) => {
    expect(z.object(requiredStudentDetails).safeParse({ ...details, [key]: "" }).success).toBe(
      false,
    );
    const missing = { ...details };
    delete missing[key as keyof typeof details];
    expect(z.object(requiredStudentDetails).safeParse(missing).success).toBe(false);
  });
  it("normalizes mobile prefix and preserves roll number leading zeros", () => {
    const parsed = z
      .object(requiredStudentDetails)
      .parse({ ...details, contactNumber: "+91 98765 43210" });
    expect(parsed.contactNumber).toBe("9876543210");
    expect(parsed.rollNumber).toBe("007");
  });
  it("limits long text and validates contact numbers", () => {
    expect(
      z.object(requiredStudentDetails).safeParse({ ...details, address: "x".repeat(501) }).success,
    ).toBe(false);
    expect(
      z.object(requiredStudentDetails).safeParse({ ...details, motherName: "x".repeat(121) })
        .success,
    ).toBe(false);
    expect(
      z.object(requiredStudentDetails).safeParse({ ...details, contactNumber: "123" }).success,
    ).toBe(false);
  });
});

describe("new import fields preserve account and class boundaries", () => {
  it("retains distinct mother, student contact and parent login details", () => {
    const [r] = validateRows([row()], context);
    expect(r!.action).toBe("create");
    expect(r!.row).toMatchObject({
      motherName: "Mother A",
      contactNumber: "9876543210",
      parentName: "Guardian A",
      parentPhone: "9123456780",
      rollNumber: "007",
    });
  });
  it.each(["Roll Number", "Date of Birth", "Mother’s Name", "Address", "Contact Number"] as const)(
    "rejects blank %s",
    (column) => {
      expect(validateRows([row({ [column]: "" })], context)[0]!.action).toBe("error");
    },
  );
  it("normalizes DOB and ignores typed age, including stale formula results", () => {
    const [r] = validateRows(
      [row({ "Date of Birth": "12/05/2017", "Age (as of today)": "99" })],
      context,
    );
    expect(r!.row.dateOfBirth).toBe("2017-05-12");
    expect(r!.row).not.toHaveProperty("age");
    expect(r!.action).toBe("create");
  });
  it("still rejects imports into unassigned classes", () => {
    expect(validateRows([row({ Class: "Class 6" })], context)[0]!.action).toBe("error");
  });
  it("still updates by GR and rejects duplicate GRs in a file", () => {
    const r = validateRows([row(), { ...row(), rowNumber: 4 }], {
      ...context,
      existingByGr: { "gr-100": { id: "student-a", fullName: "Child A" } },
    });
    expect(r[0]!.action).toBe("update");
    expect(r[1]!.action).toBe("error");
  });
});
