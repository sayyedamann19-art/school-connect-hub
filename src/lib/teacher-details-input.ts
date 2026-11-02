import { z } from "zod";

/** A calendar date, without converting a joining date into an instant in time. */
export const teacherJoiningDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid joining date")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !value.startsWith("0000-") && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Choose a valid joining date");

export const teacherQualification = z.string().trim().max(200, "Use at most 200 characters");

/** The school day is in India even when the administrator's device is elsewhere. */
export function schoolToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function displayTeacherJoiningDate(value: string | null): string {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}
