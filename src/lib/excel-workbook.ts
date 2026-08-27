/**
 * Browser-only Excel helpers. ExcelJS is dynamically imported so it is never
 * part of the initial page load or the server bundle.
 */
import {
  IMPORT_COLUMNS,
  REQUIRED_COLUMNS,
  type ImportColumn,
  type RawRow,
} from "@/lib/student-import";

const NAVY = "FF1B2A4A";

const INSTRUCTIONS: [string, string, string, string][] = [
  ["Column", "Required", "Format", "Example"],
  ["Roll Number", "Optional", "Letters, numbers or - (max 16 characters)", "12"],
  [
    "GR Number",
    "Required",
    "Unique for every student. Letters, numbers, - and / only. Never reuse a GR number.",
    "202600145",
  ],
  ["Student Name", "Required", "Full name as it should appear in the app", "Aarav Sharma"],
  ["Height", "Optional", "Number in centimetres", "132.5"],
  ["Weight", "Optional", "Number in kilograms", "28.4"],
  ["Class", "Required", "Class name exactly as used by the school", "Class 5"],
  ["Division", "Optional", "Single division/section label", "A"],
  ["Parent Name", "Required", "Parent or guardian full name", "Rahul Sharma"],
  [
    "Parent Phone Number",
    "Required",
    "10-digit Indian mobile number. This is also the parent's first-time password.",
    "9876543210",
  ],
];

const NOTES = [
  "Fill only the Student Data sheet. Do not rename, reorder or remove columns.",
  "One row per student. Leave the header row untouched.",
  "GR Number must be unique across the whole school. Rows with a repeated GR number are rejected.",
  "If a GR number already exists, that student's record is updated instead of duplicated.",
  "Parents are matched by phone number, so siblings sharing a phone number share one parent login.",
  "Parents sign in with their child's GR Number as the login ID and their phone number as the password.",
  "Rows with errors are never imported — fix them and upload the file again.",
];

export async function downloadStudentTemplate() {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "School Connect";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Student Data", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = IMPORT_COLUMNS.map((column) => ({
    header: column,
    key: column,
    width: Math.max(14, column.length + 6),
  }));

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Arial", size: 11 };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  header.alignment = { vertical: "middle", horizontal: "left" };
  header.height = 22;

  // GR number, roll number and phone stay text so leading zeros survive.
  for (const column of ["Roll Number", "GR Number", "Parent Phone Number"] as ImportColumn[]) {
    sheet.getColumn(column).numFmt = "@";
  }

  const example = sheet.addRow({
    "Roll Number": "12",
    "GR Number": "202600145",
    "Student Name": "Aarav Sharma",
    Height: 132.5,
    Weight: 28.4,
    Class: "Class 5",
    Division: "A",
    "Parent Name": "Rahul Sharma",
    "Parent Phone Number": "9876543210",
  });
  example.font = { italic: true, color: { argb: "FF8A94A6" }, name: "Arial" };

  const heightLetter = sheet.getColumn("Height").letter;
  const weightLetter = sheet.getColumn("Weight").letter;
  // Range-based validation keeps the workbook small; ExcelJS types omit this API.
  (
    sheet as unknown as {
      dataValidations: { add: (range: string, validation: unknown) => void };
    }
  ).dataValidations.add(`${heightLetter}2:${weightLetter}501`, {
    type: "decimal",
    operator: "greaterThan",
    formulae: [0],
    allowBlank: true,
    showErrorMessage: true,
    errorTitle: "Numbers only",
    error: "Enter height in cm and weight in kg as a number.",
  });



  const info = workbook.addWorksheet("Instructions");
  info.columns = [{ width: 24 }, { width: 12 }, { width: 62 }, { width: 18 }];
  const title = info.addRow(["School Connect — Student Import Template"]);
  title.font = { bold: true, size: 14, name: "Arial", color: { argb: NAVY } };
  info.addRow([]);
  INSTRUCTIONS.forEach((row, index) => {
    const added = info.addRow(row);
    added.alignment = { wrapText: true, vertical: "top" };
    if (index === 0) {
      added.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Arial" };
      added.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    } else {
      added.font = { name: "Arial" };
    }
  });
  info.addRow([]);
  const rulesTitle = info.addRow(["Rules"]);
  rulesTitle.font = { bold: true, name: "Arial", color: { argb: NAVY } };
  NOTES.forEach((note) => {
    const added = info.addRow([`• ${note}`]);
    added.font = { name: "Arial" };
    info.mergeCells(`A${added.number}:D${added.number}`);
    added.alignment = { wrapText: true, vertical: "top" };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([new Uint8Array(buffer as ArrayBuffer)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "school-connect-student-import-template.xlsx";
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoke after the browser has started the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}


export type ParsedWorkbook = {
  rows: RawRow[];
  fileErrors: string[];
  unexpectedColumns: string[];
};

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    const rich = value as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (Array.isArray(rich.richText)) return rich.richText.map((part) => part.text).join("");
    if (typeof rich.text === "string") return rich.text;
    if (rich.result !== undefined) return cellToString(rich.result);
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return "";
  }
  return String(value);
}

export async function parseStudentWorkbook(file: File): Promise<ParsedWorkbook> {
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return { rows: [], fileErrors: ["The file must be an .xlsx Excel file."], unexpectedColumns: [] };
  }

  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(await file.arrayBuffer());
  } catch {
    return {
      rows: [],
      fileErrors: ["This file couldn't be read. Please use the official template."],
      unexpectedColumns: [],
    };
  }

  const sheet = workbook.getWorksheet("Student Data") ?? workbook.worksheets[0];
  if (!sheet) {
    return { rows: [], fileErrors: ["No 'Student Data' sheet was found."], unexpectedColumns: [] };
  }

  const headerRow = sheet.getRow(1);
  const headerByColumn = new Map<string, number>();
  const unexpectedColumns: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
    const label = cellToString(cell.value).trim();
    if (!label) return;
    const match = IMPORT_COLUMNS.find((column) => column.toLowerCase() === label.toLowerCase());
    if (match) headerByColumn.set(match, columnNumber);
    else unexpectedColumns.push(label);
  });

  const missing = IMPORT_COLUMNS.filter((column) => !headerByColumn.has(column));
  const fileErrors: string[] = [];
  const missingRequired = missing.filter((column) => REQUIRED_COLUMNS.includes(column));
  if (missingRequired.length) {
    fileErrors.push(`Missing required column(s): ${missingRequired.join(", ")}.`);
  }
  const missingOptional = missing.filter((column) => !REQUIRED_COLUMNS.includes(column));
  if (missingOptional.length) {
    fileErrors.push(
      `Column name(s) don't match the official template: ${missingOptional.join(", ")}.`,
    );
  }
  if (fileErrors.length) return { rows: [], fileErrors, unexpectedColumns };

  const rows: RawRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = {} as Record<ImportColumn, string>;
    let hasValue = false;
    for (const column of IMPORT_COLUMNS) {
      const columnNumber = headerByColumn.get(column);
      const raw = columnNumber ? cellToString(row.getCell(columnNumber).value).trim() : "";
      values[column] = raw;
      if (raw) hasValue = true;
    }
    if (!hasValue) return;
    // Skip the greyed example row shipped with the template.
    if (values["GR Number"] === "202600145" && values["Student Name"] === "Aarav Sharma") return;
    rows.push({ rowNumber, values });
  });

  if (rows.length === 0) fileErrors.push("The Student Data sheet has no student rows.");
  if (rows.length > 1000) fileErrors.push("Please import at most 1000 students per file.");

  return { rows, fileErrors, unexpectedColumns };
}
