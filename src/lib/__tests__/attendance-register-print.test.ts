import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import {
  buildClassAttendanceRegister,
  paginateRegisterRows,
  type RegisterStudent,
} from "../attendance-register";

vi.mock("@/lib/attendance-register.functions", () => ({ getClassAttendanceRegister: vi.fn() }));
import { ClassRegisterPages } from "@/components/students/class-attendance-register";

const names = [
  "Aarav Deshmukh",
  "Anaya Patil",
  "Ishaan Shaikh",
  "Meera Kulkarni",
  "Kabir Pawar",
  "Sara Khan",
  "Vihaan Joshi",
  "Riya Jadhav",
];
const students: RegisterStudent[] = Array.from({ length: 23 }, (_, i) => ({
  id: `student-${i}`,
  full_name: `${names[i % names.length]} ${i + 1}`,
  gr_number: `TEST-${String(i + 1).padStart(3, "0")}`,
  roll_number: String(i + 1),
  date_of_birth: "2017-05-12",
  mother_name: ["Priya Deshmukh", "Neha Patil", "Sana Shaikh", "Pooja Kulkarni"][i % 4]!,
  address: i === 5 ? "Long residential address, ".repeat(18) : `${i + 1} Sample Road, Nashik`,
  contact_number: "98XXXXXX01",
}));
const report = buildClassAttendanceRegister(
  { id: "class-a", name: "Class 5", division: "A", academic_year: "2026-2027" },
  "2026-10",
  students,
  students.flatMap((s) =>
    Array.from({ length: 27 }, (_, i) => ({
      student_id: s.id,
      date: `2026-10-${String(i + 1).padStart(2, "0")}`,
      status: i === 6 ? ("absent" as const) : ("present" as const),
    })),
  ),
  "2026-11-03",
);

it("repeats clear headings, page numbers and signature lines while retaining the whole class", () => {
  const html = renderToStaticMarkup(createElement(ClassRegisterPages, { report }));
  const pages = paginateRegisterRows(report.rows).length;
  expect(html.match(/DAWN BREAKERS SCHOOL/g) || []).toHaveLength(pages);
  expect(html.match(/Mother&#x27;s name/g) || []).toHaveLength(pages);
  expect(html.match(/Class teacher signature/g) || []).toHaveLength(pages);
  expect(html.match(/class="register-total"/g) || []).toHaveLength(1);
  for (const s of students) expect(html).toContain(s.gr_number);
  expect(html).toContain(`Page ${pages} of ${pages}`);
  expect(html).not.toContain("Character");
  expect(html).not.toContain("feedback");
  expect(html).not.toContain("exam");
});
it("escapes profile text and does not render source HTML as executable markup", () => {
  const malicious = {
    ...report,
    rows: [{ ...report.rows[0]!, address: "<script>alert(1)</script>" }],
  };
  const html = renderToStaticMarkup(createElement(ClassRegisterPages, { report: malicious }));
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("<script>");
});
it("retains the original A4 marksheet size and uses a separately named A3 register page", () => {
  const css = readFileSync("src/styles.css", "utf8");
  expect(css).toContain("@page { size: A4; margin: 14mm; }");
  expect(css).toContain("@page attendance-register { size: A3 landscape;");
  expect(css).toContain(":not(.marksheet-print):not(.attendance-register-print)");
});
if (process.env["REGISTER_LAYOUT_FIXTURE"]) {
  const markup = renderToStaticMarkup(createElement(ClassRegisterPages, { report }));
  const css = readFileSync("src/styles.css", "utf8").split("/* Class attendance register:")[1]!;
  writeFileSync(
    "/tmp/attendance-register-layout.html",
    `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0} /* Class attendance register:${css}</style></head><body><div class="attendance-register-print">${markup}</div></body></html>`,
  );
  writeFileSync(
    "/tmp/attendance-register-layout-pages.txt",
    String(paginateRegisterRows(report.rows).length),
  );
}
