import { describe, expect, it } from "vitest";
import { displayTeacherJoiningDate, schoolToday, teacherJoiningDate, teacherQualification } from "./teacher-details-input";

describe("teacher employment details", () => {
  it.each(["2026-11-02", "2024-02-29", "2000-02-29"])("accepts the calendar date %s", (value) => {
    expect(teacherJoiningDate.safeParse(value).success).toBe(true);
  });

  it.each(["", "2026-02-29", "2026-04-31", "2026-13-01", "0000-01-01", "02/11/2026"])("rejects the invalid date %s", (value) => {
    expect(teacherJoiningDate.safeParse(value).success).toBe(false);
  });

  it("uses the school day across midnight in India", () => {
    expect(schoolToday(new Date("2026-11-02T18:29:59Z"))).toBe("2026-11-02");
    expect(schoolToday(new Date("2026-11-02T18:30:00Z"))).toBe("2026-11-03");
  });

  it("keeps historical dates unknown and formats known dates without shifting days", () => {
    expect(displayTeacherJoiningDate(null)).toBe("Not recorded");
    expect(displayTeacherJoiningDate("2020-06-01")).toBe("01 Jun 2020");
  });

  it("trims qualifications and limits their length", () => {
    expect(teacherQualification.parse("  B.Ed.  ")).toBe("B.Ed.");
    expect(teacherQualification.safeParse("x".repeat(200)).success).toBe(true);
    expect(teacherQualification.safeParse("x".repeat(201)).success).toBe(false);
  });
});
