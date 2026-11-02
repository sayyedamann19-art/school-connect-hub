import { schoolToday, studentAge } from "@/lib/student-details";

export type RegisterStudent = {
  id: string;
  full_name: string;
  gr_number: string;
  roll_number: string | null;
  date_of_birth: string | null;
  mother_name: string | null;
  address: string | null;
  contact_number: string | null;
};
export type RegisterStatus = "present" | "absent" | "late" | "left_early" | "other";
export type RegisterAttendance = { student_id: string; date: string; status: RegisterStatus };
export const REGISTER_CODES = {
  present: "P",
  absent: "A",
  late: "L",
  left_early: "E",
  other: "O",
} as const;
export type RegisterMark = "P" | "A" | "L" | "E" | "O" | "U" | "-";
export type RegisterTotals = {
  present: number;
  absent: number;
  late: number;
  leftEarly: number;
  other: number;
  unrecorded: number;
  recorded: number;
  percent: number | null;
};
export type RegisterRow = RegisterStudent & {
  age: number | null;
  marks: RegisterMark[];
  totals: RegisterTotals;
};
export type ClassAttendanceRegister = {
  classInfo: { id: string; name: string; division: string | null; academic_year: string };
  month: string;
  asOf: string;
  days: { date: string; day: number; weekday: string; future: boolean }[];
  rows: RegisterRow[];
  totals: RegisterTotals;
};

export function validRegisterMonth(month: string, today = schoolToday()) {
  return (
    /^\d{4}-(0[1-9]|1[0-2])$/.test(month) &&
    !month.startsWith("0000-") &&
    month <= today.slice(0, 7)
  );
}

export function registerPeriod(month: string, today = schoolToday()) {
  if (!validRegisterMonth(month, today))
    throw new Error("Choose a valid month that is not in the future");
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5));
  // setUTCFullYear avoids Date.UTC's special handling of years 00-99.
  const end = new Date(0);
  end.setUTCFullYear(year, monthNumber, 0);
  const days = end.getUTCDate();
  const lastDate = `${month}-${String(days).padStart(2, "0")}`;
  return { from: `${month}-01`, to: lastDate < today ? lastDate : today, days };
}

function emptyTotals(): RegisterTotals {
  return {
    present: 0,
    absent: 0,
    late: 0,
    leftEarly: 0,
    other: 0,
    unrecorded: 0,
    recorded: 0,
    percent: null,
  };
}

/** Uses the existing report's Present / recorded days calculation. No attendance is inferred. */
export function buildClassAttendanceRegister(
  classInfo: ClassAttendanceRegister["classInfo"],
  month: string,
  students: RegisterStudent[],
  attendance: RegisterAttendance[],
  today = schoolToday(),
): ClassAttendanceRegister {
  const period = registerPeriod(month, today);
  const studentIds = new Set(students.map((s) => s.id));
  if (studentIds.size !== students.length)
    throw new Error("Duplicate students found; reload the register");
  const days = Array.from({ length: period.days }, (_, i) => {
    const day = i + 1;
    const date = `${month}-${String(day).padStart(2, "0")}`;
    return {
      date,
      day,
      weekday: new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" }).format(
        new Date(`${date}T00:00:00Z`),
      ),
      future: date > period.to,
    };
  });
  const byStudent = new Map<string, Map<string, RegisterStatus>>();
  for (const record of attendance) {
    if (!studentIds.has(record.student_id) || record.date < period.from || record.date > period.to)
      continue;
    if (!(record.status in REGISTER_CODES))
      throw new Error("Unknown attendance status; check the source records");
    const own = byStudent.get(record.student_id) ?? new Map<string, RegisterStatus>();
    if (own.has(record.date))
      throw new Error("More than one attendance record exists for a student on the same date");
    own.set(record.date, record.status);
    byStudent.set(record.student_id, own);
  }
  const aggregate = emptyTotals();
  const rows = [...students]
    .sort(
      (a, b) =>
        (a.roll_number ?? "").localeCompare(b.roll_number ?? "", "en", { numeric: true }) ||
        a.full_name.localeCompare(b.full_name) ||
        a.id.localeCompare(b.id),
    )
    .map((student) => {
      const own = byStudent.get(student.id);
      const totals = emptyTotals();
      const marks = days.map(({ date, future }): RegisterMark => {
        if (future) return "-";
        const status = own?.get(date);
        if (!status) {
          totals.unrecorded++;
          return "U";
        }
        totals.recorded++;
        if (status === "left_early") totals.leftEarly++;
        else totals[status]++;
        return REGISTER_CODES[status];
      });
      totals.percent = totals.recorded
        ? Math.round((totals.present / totals.recorded) * 100)
        : null;
      for (const key of [
        "present",
        "absent",
        "late",
        "leftEarly",
        "other",
        "unrecorded",
        "recorded",
      ] as const)
        aggregate[key] += totals[key];
      return { ...student, age: studentAge(student.date_of_birth, period.to), marks, totals };
    });
  aggregate.percent = aggregate.recorded
    ? Math.round((aggregate.present / aggregate.recorded) * 100)
    : null;
  return { classInfo, month, asOf: period.to, days, rows, totals: aggregate };
}

/** Conservative row-height budget keeps long profile text readable instead of reducing font size. */
export function paginateRegisterRows(rows: RegisterRow[]): RegisterRow[][] {
  const pages: RegisterRow[][] = [];
  let page: RegisterRow[] = [];
  let height = 0;
  const lines = (value: string | null, chars: number) =>
    Math.max(1, Math.ceil((value?.replace(/\s+/g, " ").trim() || "Not recorded").length / chars));
  for (const row of rows) {
    const lineCount = Math.max(
      lines(row.full_name, 15),
      lines(row.mother_name, 13),
      lines(row.address, 22),
      lines(row.gr_number, 10),
      lines(row.roll_number, 4),
      2,
    );
    const rowHeight = Math.max(14, lineCount * 3.9 + 5); // mm, including cell padding
    if (page.length && (height + rowHeight > 145 || page.length >= 9)) {
      pages.push(page);
      page = [];
      height = 0;
    }
    page.push(row);
    height += rowHeight;
  }
  if (page.length) pages.push(page);
  return pages;
}
