import { describe, expect, it } from "vitest";
import {
  buildClassAttendanceRegister,
  paginateRegisterRows,
  registerPeriod,
  validRegisterMonth,
  type RegisterAttendance,
  type RegisterStudent,
} from "../attendance-register";

const schoolClass = { id: "class-a", name: "Class 5", division: "A", academic_year: "2026-2027" };
const student = (id: string, roll = "1"): RegisterStudent => ({
  id,
  full_name: `Child ${id}`,
  gr_number: `GR-${id}`,
  roll_number: roll,
  date_of_birth: "2017-11-10",
  mother_name: `Mother ${id}`,
  address: `Address ${id}`,
  contact_number: "9876543210",
});
const build = (
  students: RegisterStudent[],
  records: RegisterAttendance[] = [],
  month = "2026-11",
) => buildClassAttendanceRegister(schoolClass, month, students, records, "2026-11-03");

describe("monthly class register", () => {
  it("handles leap years, month lengths and the current school date", () => {
    expect(registerPeriod("2024-02", "2026-11-03")).toEqual({
      from: "2024-02-01",
      to: "2024-02-29",
      days: 29,
    });
    expect(registerPeriod("2025-02", "2026-11-03").days).toBe(28);
    expect(registerPeriod("2026-10", "2026-11-03").days).toBe(31);
    expect(registerPeriod("2026-11", "2026-11-03")).toEqual({
      from: "2026-11-01",
      to: "2026-11-03",
      days: 30,
    });
  });
  it.each(["2026-00", "2026-13", "bad", "2026-1", "0000-01", "2026-12"])(
    "rejects invalid or future month %s",
    (month) => {
      expect(validRegisterMonth(month, "2026-11-03")).toBe(false);
      expect(() => registerPeriod(month, "2026-11-03")).toThrow();
    },
  );
  it("keeps missing records distinct from absence, future days and actual recorded days", () => {
    const report = build(
      [student("A")],
      [{ student_id: "A", date: "2026-11-02", status: "absent" }],
    );
    expect(report.rows[0]!.marks.slice(0, 5)).toEqual(["U", "A", "U", "-", "-"]);
    expect(report.rows[0]!.totals).toMatchObject({
      absent: 1,
      unrecorded: 2,
      recorded: 1,
      percent: 0,
    });
    // No Sunday closure is invented: the system has no school calendar.
    expect(report.days[0]!.weekday).toBe("Sun");
    expect(report.rows[0]!.marks[0]).toBe("U");
  });
  it("shows no percentage when nothing was recorded", () => {
    const report = build([student("A")]);
    expect(report.rows[0]!.totals.percent).toBeNull();
    expect(report.totals.percent).toBeNull();
  });
  it("preserves existing present / all recorded statuses percentage and distinct status totals", () => {
    const statuses = ["present", "absent", "late", "left_early", "other"] as const;
    const report = build(
      [student("A")],
      statuses.map((status, i) => ({ student_id: "A", date: `2026-10-0${i + 1}`, status })),
      "2026-10",
    );
    expect(report.rows[0]!.marks.slice(0, 5)).toEqual(["P", "A", "L", "E", "O"]);
    expect(report.rows[0]!.totals).toEqual({
      present: 1,
      absent: 1,
      late: 1,
      leftEarly: 1,
      other: 1,
      unrecorded: 26,
      recorded: 5,
      percent: 20,
    });
  });
  it("isolates children and ignores other students, months and future records", () => {
    const records: RegisterAttendance[] = [
      { student_id: "A", date: "2026-11-01", status: "present" },
      { student_id: "B", date: "2026-11-02", status: "absent" },
      { student_id: "C", date: "2026-11-01", status: "late" },
      { student_id: "A", date: "2026-10-31", status: "absent" },
      { student_id: "A", date: "2026-11-05", status: "absent" },
    ];
    const report = build([student("A"), student("B")], records);
    expect(report.rows[0]!.totals).toMatchObject({ present: 1, absent: 0, recorded: 1 });
    expect(report.rows[1]!.totals).toMatchObject({ present: 0, absent: 1, recorded: 1 });
    expect(report.totals).toMatchObject({
      present: 1,
      absent: 1,
      late: 0,
      recorded: 2,
      percent: 50,
    });
  });
  it("calculates age on the report cutoff, preserves profile fields and sorts rolls naturally", () => {
    const report = build([student("B", "10"), student("A", "2")]);
    expect(report.rows.map((r) => r.roll_number)).toEqual(["2", "10"]);
    expect(report.rows[0]).toMatchObject({
      age: 8,
      mother_name: "Mother A",
      address: "Address A",
      contact_number: "9876543210",
    });
    expect(report.asOf).toBe("2026-11-03");
  });
  it("rejects duplicate students and duplicate attendance rather than printing a misleading report", () => {
    expect(() => build([student("A"), student("A")])).toThrow(/Duplicate/);
    const record = { student_id: "A", date: "2026-11-01", status: "present" as const };
    expect(() => build([student("A")], [record, record])).toThrow(/More than one/);
  });
  it("keeps legacy missing profile details and inactive historical students printable", () => {
    const report = build([
      {
        ...student("A"),
        date_of_birth: null,
        mother_name: null,
        address: null,
        contact_number: null,
      },
    ]);
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]!.age).toBeNull();
  });
  it("paginates the entire class in order, giving long addresses more room", () => {
    const report = build(Array.from({ length: 35 }, (_, i) => student(String(i), String(i + 1))));
    const pages = paginateRegisterRows(report.rows);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.every((p) => p.length <= 9)).toBe(true);
    expect(pages.flat().map((r) => r.id)).toEqual(report.rows.map((r) => r.id));
    const long = report.rows.map((r) => ({
      ...r,
      address: "Long residential address ".repeat(20),
    }));
    expect(paginateRegisterRows(long).length).toBeGreaterThan(pages.length);
    expect(paginateRegisterRows([])).toEqual([]);
  });
});
