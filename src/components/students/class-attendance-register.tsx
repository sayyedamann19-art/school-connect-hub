import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SectionCard } from "@/components/common/section-card";
import { adminClassAttendanceRegister } from "@/lib/attendance-register.functions";
import {
  paginateRegisterRows,
  validRegisterMonth,
  type ClassAttendanceRegister as Register,
  type RegisterTotals,
} from "@/lib/attendance-register";
import { schoolToday } from "@/lib/student-details";

const formatDate = (value: string) => value.split("-").reverse().join("/");
const text = (value: string | null) => value?.replace(/\s+/g, " ").trim() || "Not recorded";
const profileWidths = [11, 30, 22, 21, 9, 27, 44, 24];
const totalWidths = [12, 12, 10, 13, 11, 18, 13, 17];
const totalHeadings = [
  "Present",
  "Absent",
  "Late",
  "Left early",
  "Other",
  "Unrecorded",
  "Days recorded",
  "Attendance %",
];

function TotalsCells({ totals }: { totals: RegisterTotals }) {
  return (
    <>
      {[
        totals.present,
        totals.absent,
        totals.late,
        totals.leftEarly,
        totals.other,
        totals.unrecorded,
        totals.recorded,
        totals.percent === null ? "-" : `${totals.percent}%`,
      ].map((value, i) => (
        <td key={i}>{value}</td>
      ))}
    </>
  );
}

/** The preview and printed output use exactly the same content. No attendance writes. */
export function ClassRegisterPages({ report }: { report: Register }) {
  const pages = paginateRegisterRows(report.rows);
  const monthLabel = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${report.month}-01T00:00:00Z`));
  const classLabel = `${report.classInfo.name}${report.classInfo.division ? ` - Division ${report.classInfo.division}` : ""}`;
  return (
    <>
      {pages.map((rows, index) => (
        <section
          className="attendance-register-page"
          key={index}
          aria-label={`Register page ${index + 1}`}
        >
          <table>
            <colgroup>
              {profileWidths.map((width, i) => (
                <col key={`profile-${i}`} style={{ width: `${width}mm` }} />
              ))}
              {report.days.map((day) => (
                <col key={day.date} style={{ width: "3.4mm" }} />
              ))}
              {totalWidths.map((width, i) => (
                <col key={`total-${i}`} style={{ width: `${width}mm` }} />
              ))}
            </colgroup>
            <thead>
              <tr className="register-title-row">
                <th colSpan={16 + report.days.length}>
                  <h2>DAWN BREAKERS SCHOOL</h2>
                  <h3>Class Attendance Register</h3>
                  <p>
                    {classLabel} <span>Academic year {report.classInfo.academic_year}</span>{" "}
                    <span>{monthLabel}</span>
                  </p>
                  <div className="register-meta">
                    <span>Students: {report.rows.length}</span>
                    <span>Age and attendance as of {formatDate(report.asOf)}</span>
                    <span>
                      Page {index + 1} of {pages.length}
                    </span>
                  </div>
                </th>
              </tr>
              <tr>
                <th colSpan={8}>Student details</th>
                <th colSpan={report.days.length}>Daily attendance</th>
                <th colSpan={8}>Attendance totals</th>
              </tr>
              <tr>
                {[
                  "Roll number",
                  "Student name",
                  "G.R. number",
                  "Date of birth",
                  "Age",
                  "Mother's name",
                  "Address",
                  "Contact number",
                ].map((label) => (
                  <th key={label} scope="col">
                    {label}
                  </th>
                ))}
                {report.days.map((day) => (
                  <th key={day.date} scope="col" className="register-day">
                    <div>{day.day}</div>
                    <small>{day.weekday.slice(0, 1)}</small>
                  </th>
                ))}
                {totalHeadings.map((label) => (
                  <th key={label} scope="col">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{text(row.roll_number)}</td>
                  <td className="register-profile">{text(row.full_name)}</td>
                  <td>{text(row.gr_number)}</td>
                  <td>{row.date_of_birth ? formatDate(row.date_of_birth) : "Not recorded"}</td>
                  <td>{row.age ?? "-"}</td>
                  <td className="register-profile">{text(row.mother_name)}</td>
                  <td className="register-profile">{text(row.address)}</td>
                  <td>{text(row.contact_number)}</td>
                  {row.marks.map((mark, day) => (
                    <td
                      key={day}
                      className={`register-mark register-mark-${mark === "-" ? "future" : mark}`}
                    >
                      {mark}
                    </td>
                  ))}
                  <TotalsCells totals={row.totals} />
                </tr>
              ))}
              {index === pages.length - 1 ? (
                <tr className="register-total">
                  <th colSpan={8 + report.days.length}>Class totals</th>
                  <TotalsCells totals={report.totals} />
                </tr>
              ) : null}
            </tbody>
            <tfoot>
              <tr className="register-footer-row">
                <td colSpan={16 + report.days.length}>
                  <p className="register-key">
                    P Present · A Absent · L Late · E Left early · O Other · U Unrecorded · - Future
                    date
                  </p>
                  <p className="register-calculation">
                    Attendance % = Present / days recorded × 100. Unrecorded and future dates are
                    excluded.
                  </p>
                  <div className="register-signatures">
                    <span>Class teacher signature / date</span>
                    <span>Principal signature / date</span>
                    <span>School seal</span>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </section>
      ))}
    </>
  );
}

function RegisterPreview({
  classId,
  month,
  onClose,
}: {
  classId: string;
  month: string;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const query = useQuery({
    queryKey: ["admin", "class-attendance-register", classId, month],
    queryFn: () => adminClassAttendanceRegister({ data: { classId, month } }),
    gcTime: 0,
    staleTime: 0,
    retry: false,
  });
  const report = query.data;
  const canPrint = !query.isFetching && !query.isError && Boolean(report?.rows.length);
  const print = async () => {
    await document.fonts.ready;
    window.print();
  };
  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <DialogContent className="flex max-h-[95vh] w-[96vw] max-w-none flex-col sm:max-w-[96vw]">
          <DialogHeader>
            <DialogTitle>Class attendance register</DialogTitle>
            <DialogDescription>
              Review the register, then print or save it as a PDF. Paper: A3 landscape.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={!canPrint} onClick={() => void print()}>
              <Printer className="mr-2 size-4" />
              Print / Save PDF
            </Button>
            <Button
              variant="outline"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              Refresh records
            </Button>
          </div>
          <div className="min-h-0 overflow-auto rounded-lg border border-border bg-muted/30 p-4">
            {query.isPending || query.isFetching ? (
              <p role="status">Loading student details and attendance…</p>
            ) : query.isError ? (
              <p role="alert">{query.error.message}</p>
            ) : !report?.rows.length ? (
              <p>No students in this class. Add students before printing a register.</p>
            ) : (
              <div className="attendance-register-preview">
                <ClassRegisterPages report={report} />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {mounted && canPrint && report
        ? createPortal(
            <div className="attendance-register-print">
              <ClassRegisterPages report={report} />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export function ClassAttendanceRegister({ classId }: { classId: string }) {
  const [month, setMonth] = useState(() => schoolToday().slice(0, 7));
  const [open, setOpen] = useState(false);
  return (
    <SectionCard
      title="Print class register"
      description="Student profile details and daily attendance for one month."
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="attendance-register-month">Month</Label>
          <Input
            id="attendance-register-month"
            type="month"
            max={schoolToday().slice(0, 7)}
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              setOpen(false);
            }}
          />
        </div>
        <Button
          variant="outline"
          disabled={!classId || !validRegisterMonth(month)}
          onClick={() => setOpen(true)}
        >
          <Printer className="mr-2 size-4" />
          Preview register
        </Button>
      </div>
      {open ? (
        <RegisterPreview
          key={`${classId}:${month}`}
          classId={classId}
          month={month}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </SectionCard>
  );
}
