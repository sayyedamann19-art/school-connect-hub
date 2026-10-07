import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import logo from "@/assets/dawn-breakers-logo.jpg.asset.json";
import type { AcademicExam, ExamSummary, ResultRow } from "@/lib/academics.functions";

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

/** A4 report-card layout; mounted on <body> so only it appears when printing. */
export function PrintableMarksheet({
  exam,
  student,
  classInfo,
  results,
  summary,
}: {
  exam: AcademicExam;
  student: { full_name: string; gr_number: string; roll_number: string | null };
  classInfo: { name: string; division: string | null } | null;
  results: ResultRow[];
  summary: ExamSummary;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const cell = { border: "1px solid #000", padding: "6px 8px" } as const;
  const info: [string, string][] = [
    ["Student name", student.full_name],
    ["GR number", student.gr_number],
    ["Class", classInfo?.name ?? "—"],
    ["Division", classInfo?.division ?? "—"],
    ["Roll number", student.roll_number ?? "—"],
    ["Academic year", exam.academic_year],
  ];
  const overall = summary.maximum > 0 ? (summary.obtained / summary.maximum) * 100 : null;

  return createPortal(
    <div className="marksheet-print" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 16, borderBottom: "2px solid #000", paddingBottom: 12 }}>
        <img src={logo.url} alt="" style={{ width: 72, height: 72, borderRadius: "50%" }} />
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: "20pt", fontWeight: 800, letterSpacing: 1 }}>DAWN BREAKERS SCHOOL</div>
          <div style={{ fontSize: "12pt", fontWeight: 700, marginTop: 4 }}>Marksheet — {exam.name}</div>
          <div style={{ fontSize: "10pt", marginTop: 2 }}>Academic year {exam.academic_year}</div>
        </div>
        <div style={{ width: 72 }} />
      </header>

      <table style={{ marginTop: 16 }}>
        <tbody>
          {[0, 2, 4].map((i) => (
            <tr key={i}>
              <th style={{ ...cell, textAlign: "left", width: "18%" }}>{info[i][0]}</th>
              <td style={{ ...cell, width: "32%" }}>{info[i][1]}</td>
              <th style={{ ...cell, textAlign: "left", width: "18%" }}>{info[i + 1][0]}</th>
              <td style={{ ...cell, width: "32%" }}>{info[i + 1][1]}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table style={{ marginTop: 16 }}>
        <thead>
          <tr>
            <th style={{ ...cell, textAlign: "left", width: "8%" }}>#</th>
            <th style={{ ...cell, textAlign: "left" }}>Subject</th>
            <th style={{ ...cell, textAlign: "center", width: "18%" }}>Maximum marks</th>
            <th style={{ ...cell, textAlign: "center", width: "18%" }}>Marks obtained</th>
            <th style={{ ...cell, textAlign: "center", width: "16%" }}>Percentage</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => {
            const present = r.status === "present" && r.marks_obtained !== null;
            return (
              <tr key={r.id}>
                <td style={cell}>{i + 1}</td>
                <td style={cell}>{r.subject_name}</td>
                <td style={{ ...cell, textAlign: "center" }}>{fmt(r.maximum_marks)}</td>
                <td style={{ ...cell, textAlign: "center" }}>
                  {present ? fmt(r.marks_obtained!) : r.status === "absent" ? "Absent" : "N/A"}
                </td>
                <td style={{ ...cell, textAlign: "center" }}>
                  {present ? `${((r.marks_obtained! / r.maximum_marks) * 100).toFixed(2)}%` : "—"}
                </td>
              </tr>
            );
          })}
          <tr>
            <th style={{ ...cell, textAlign: "left" }} colSpan={2}>Total</th>
            <th style={{ ...cell, textAlign: "center" }}>{fmt(summary.maximum)}</th>
            <th style={{ ...cell, textAlign: "center" }}>{fmt(summary.obtained)}</th>
            <th style={{ ...cell, textAlign: "center" }}>
              {summary.complete && overall !== null ? `${overall.toFixed(2)}%` : "—"}
            </th>
          </tr>
        </tbody>
      </table>

      <p style={{ marginTop: 12, fontSize: "9.5pt" }}>
        {summary.complete
          ? `Overall percentage: ${overall !== null ? overall.toFixed(2) + "%" : "—"}.`
          : "Some subjects have no marks recorded yet, so no final percentage is shown."}
        {summary.absent > 0 || summary.notApplicable > 0
          ? " Absent and not-applicable subjects are not counted in the total."
          : ""}
      </p>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 72, gap: 24 }}>
        {["Class teacher", "Principal", "Parent / guardian"].map((label) => (
          <div key={label} style={{ flex: 1, textAlign: "center", borderTop: "1px solid #000", paddingTop: 6, fontSize: "10pt" }}>
            {label}
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
}
