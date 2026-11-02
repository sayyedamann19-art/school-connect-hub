import { z } from "zod";
import { schoolToday } from "@/lib/teacher-details-input";

export { schoolToday };

export function validBirthDate(value: string, today = schoolToday()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000-")) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value &&
    value <= today
  );
}

/** Completed years on the school date; age is never stored or trusted from Excel. */
export function studentAge(dob: string | null | undefined, today = schoolToday()): number | null {
  if (!dob || !validBirthDate(dob, today)) return null;
  let years = Number(today.slice(0, 4)) - Number(dob.slice(0, 4));
  if (today.slice(5) < dob.slice(5)) years -= 1;
  return years;
}

export function ageLabel(dob: string | null | undefined): string {
  const age = studentAge(dob);
  return age === null ? "Not recorded" : `${age} years (as of ${schoolToday()})`;
}

export function normaliseContact(value: string): string {
  return value
    .trim()
    .replace(/[\s()-]/g, "")
    .replace(/^(\+91|0091|91)(?=\d{10}$)/, "");
}

export const birthDate = z
  .string()
  .trim()
  .refine((value) => validBirthDate(value), "Enter a real date of birth that is not in the future");
export const motherName = z.string().trim().min(1, "Mother's name is required").max(120);
export const studentAddress = z.string().trim().min(1, "Address is required").max(500);
export const contactNumber = z
  .string()
  .transform(normaliseContact)
  .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit contact number"));
export const studentRollNumber = z
  .string()
  .trim()
  .regex(
    /^[A-Za-z0-9-]{1,16}$/,
    "Roll number is required; use letters, numbers or - (up to 16 characters)",
  );
export const requiredStudentDetails = {
  rollNumber: studentRollNumber,
  dateOfBirth: birthDate,
  motherName,
  address: studentAddress,
  contactNumber,
};

/** Supports YYYY-MM-DD and the school's unambiguous DD/MM/YYYY format. */
export function normaliseBirthDate(value: string): string {
  const text = value.trim();
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : text;
}
