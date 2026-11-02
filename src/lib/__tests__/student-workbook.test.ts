import { describe, expect, it } from "vitest";
import { buildStudentTemplate, parseStudentWorkbook } from "../excel-workbook";
import { validateRows } from "../student-import";

async function file(workbook: Awaited<ReturnType<typeof buildStudentTemplate>>) {
  const data = await workbook.xlsx.writeBuffer();
  return new File([new Uint8Array(data as ArrayBuffer)], "students.xlsx");
}
async function templateWithChild() {
  const book = await buildStudentTemplate({ name: "Class 5", division: "A" });
  const sheet = book.getWorksheet("Student Data")!;
  // Use a row with an already-generated age formula, like a person filling the template.
  const row = sheet.getRow(3);
  for (const [key, value] of Object.entries({
    "Roll Number": "007",
    "GR Number": "GR-100",
    "Student Name": "Child A",
    "Date of Birth": "2017-05-12",
    "Mother’s Name": "Mother A",
    Address: "Nashik",
    "Contact Number": "9876543210",
    "Parent Name": "Guardian A",
    "Parent Phone Number": "9123456780",
  }))
    row.getCell(key).value = value;
  return { book, sheet, row };
}

describe("student Excel template round trip", () => {
  it("has automatic age, skips example/formula-only rows and retains text identifiers", async () => {
    const { book, row } = await templateWithChild();
    expect(row.getCell("Age (as of today)").formula).toContain("TODAY()");
    const parsed = await parseStudentWorkbook(await file(book));
    expect(parsed.fileErrors).toEqual([]);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]!.values["Roll Number"]).toBe("007");
    const [r] = validateRows(parsed.rows, {
      existingByGr: {},
      allowedClassKeys: ["class 5|a"],
      targetClass: { name: "Class 5", division: "A" },
    });
    expect(r!.action).toBe("create");
    expect(r!.row.motherName).toBe("Mother A");
  });
  it.each(["text", "excel date", "excel serial", "1904 serial"])(
    "handles DOB as %s",
    async (kind) => {
      const { book, row } = await templateWithChild();
      if (kind === "text") row.getCell("Date of Birth").value = "12/05/2017";
      if (kind === "excel date") {
        row.getCell("Date of Birth").value = new Date("2017-05-12T00:00:00Z");
        row.getCell("Date of Birth").numFmt = "dd/mm/yyyy";
      }
      if (kind.includes("serial")) {
        book.properties.date1904 = kind === "1904 serial";
        const epoch = book.properties.date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
        row.getCell("Date of Birth").value = (Date.UTC(2017, 4, 12) - epoch) / 86400000;
      }
      const parsed = await parseStudentWorkbook(await file(book));
      const [r] = validateRows(parsed.rows, {
        existingByGr: {},
        allowedClassKeys: null,
        targetClass: { name: "Class 5", division: "A" },
      });
      expect(r!.action).toBe("create");
      expect(r!.row.dateOfBirth).toBe("2017-05-12");
    },
  );
  it("rejects an old template missing the new required headers", async () => {
    const { book, sheet } = await templateWithChild();
    sheet.getRow(1).getCell("Mother’s Name").value = "";
    const parsed = await parseStudentWorkbook(await file(book));
    expect(parsed.fileErrors.join(" ")).toContain("Mother’s Name");
    expect(parsed.rows).toEqual([]);
  });
  it("allows 500-character addresses and accepts plain apostrophe in mother header", async () => {
    const { book, sheet, row } = await templateWithChild();
    sheet.getRow(1).getCell("Mother’s Name").value = "Mother's Name";
    row.getCell("Address").value = "a".repeat(500);
    const parsed = await parseStudentWorkbook(await file(book));
    expect(parsed.fileErrors).toEqual([]);
    expect(parsed.rows[0]!.values.Address).toHaveLength(500);
  });
});
