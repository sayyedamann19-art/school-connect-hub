/**
 * Shared model for the Excel student importer: official column contract,
 * row validation and the create/update decision. Used by the browser
 * (template download, parsing, preview) and by the import server function
 * (re-validated server-side before anything is written).
 */

export const IMPORT_COLUMNS = [
  "Roll Number",
  "GR Number",
  "Student Name",
  "Height",
  "Weight",
  "Class",
  "Division",
  "Parent Name",
  "Parent Phone Number",
] as const;

export type ImportColumn = (typeof IMPORT_COLUMNS)[number];

export const REQUIRED_COLUMNS: ImportColumn[] = [
  "GR Number",
  "Student Name",
  "Class",
  "Parent Name",
  "Parent Phone Number",
];

export type RawRow = {
  rowNumber: number;
  values: Record<ImportColumn, string>;
};

export type ImportRow = {
  rowNumber: number;
  grNumber: string;
  fullName: string;
  rollNumber: string | null;
  className: string;
  division: string | null;
  heightCm: number | null;
  weightKg: number | null;
  parentName: string;
  parentPhone: string;
};

export type ValidatedRow = {
  row: ImportRow;
  action: "create" | "update" | "error";
  errors: string[];
  warnings: string[];
  existingStudentName?: string;
};

export type ImportContext = {
  /** Lowercased GR number -> existing student summary. */
  existingByGr: Record<string, { id: string; fullName: string }>;
  /** Lowercased "class|division" keys a class teacher may import into; null = admin (any). */
  allowedClassKeys: string[] | null;
};

export function classKey(name: string, division: string | null | undefined) {
  return `${name.trim().toLowerCase()}|${(division ?? "").trim().toLowerCase()}`;
}

const PHONE_RE = /^[6-9]\d{9}$/;
const GR_RE = /^[A-Za-z0-9/-]{3,32}$/;

function toNumber(value: string): number | null | "invalid" {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(/,/g, ""));
  if (!Number.isFinite(parsed) || parsed <= 0) return "invalid";
  return Math.round(parsed * 100) / 100;
}

function normalisePhone(value: string) {
  return value.trim().replace(/[\s()-]/g, "").replace(/^(\+91|0091|91)(?=\d{10}$)/, "");
}

export function validateRows(raw: RawRow[], context: ImportContext): ValidatedRow[] {
  const seenGr = new Map<string, number>();

  return raw.map((entry) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const get = (column: ImportColumn) => (entry.values[column] ?? "").toString().trim();

    const grNumber = get("GR Number");
    const fullName = get("Student Name");
    const className = get("Class");
    const division = get("Division") || null;
    const parentName = get("Parent Name");
    const phone = normalisePhone(get("Parent Phone Number"));
    const rollNumber = get("Roll Number") || null;

    if (!grNumber) errors.push("GR Number is required");
    else if (!GR_RE.test(grNumber)) errors.push("GR Number may only contain letters, numbers, - and /");
    else {
      const key = grNumber.toLowerCase();
      const previous = seenGr.get(key);
      if (previous) errors.push(`Duplicate GR Number — also used on row ${previous}`);
      else seenGr.set(key, entry.rowNumber);
    }

    if (!fullName) errors.push("Student Name is required");
    else if (fullName.length > 120) errors.push("Student Name is too long");

    if (!className) errors.push("Class is required");
    if (!parentName) errors.push("Parent Name is required");
    else if (parentName.length > 120) errors.push("Parent Name is too long");

    if (!phone) errors.push("Parent Phone Number is required");
    else if (!PHONE_RE.test(phone)) errors.push("Parent Phone Number must be a valid 10-digit mobile number");

    const height = toNumber(get("Height"));
    if (height === "invalid") errors.push("Height must be a positive number (cm)");
    const weight = toNumber(get("Weight"));
    if (weight === "invalid") errors.push("Weight must be a positive number (kg)");

    if (rollNumber && !/^[A-Za-z0-9-]{1,16}$/.test(rollNumber)) {
      errors.push("Roll Number may only contain letters, numbers and -");
    }

    if (
      className &&
      context.allowedClassKeys &&
      !context.allowedClassKeys.includes(classKey(className, division))
    ) {
      errors.push("You are not assigned to this class, so this row can't be imported");
    }

    const existing = grNumber ? context.existingByGr[grNumber.toLowerCase()] : undefined;
    if (existing && existing.fullName.toLowerCase() !== fullName.toLowerCase()) {
      warnings.push(`Will rename "${existing.fullName}" to "${fullName}"`);
    }
    if (height === null) warnings.push("Height is blank");
    if (weight === null) warnings.push("Weight is blank");

    const row: ImportRow = {
      rowNumber: entry.rowNumber,
      grNumber,
      fullName,
      rollNumber,
      className,
      division,
      heightCm: typeof height === "number" ? height : null,
      weightKg: typeof weight === "number" ? weight : null,
      parentName,
      parentPhone: phone,
    };

    return {
      row,
      action: errors.length ? "error" : existing ? "update" : "create",
      errors,
      warnings,
      ...(existing ? { existingStudentName: existing.fullName } : {}),
    };
  });
}

export function summarise(rows: ValidatedRow[]) {
  return {
    total: rows.length,
    valid: rows.filter((row) => row.action !== "error").length,
    create: rows.filter((row) => row.action === "create").length,
    update: rows.filter((row) => row.action === "update").length,
    errors: rows.filter((row) => row.action === "error").length,
    warnings: rows.filter((row) => row.action !== "error" && row.warnings.length > 0).length,
  };
}
