import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Printer } from "lucide-react";

import { PrintableMarksheet } from "@/components/academics/printable-marksheet";
import { Button } from "@/components/ui/button";

import { EmptyState, ErrorState, LoadingCards } from "@/components/common/states";
import { getStudentExamResult } from "@/lib/academics.functions";

export const Route = createFileRoute("/_authenticated/parent/academics/$studentId/$examId")({
  head: () => ({
    meta: [
      { title: "Exam result — Dawn Breakers School" },
      { name: "description", content: "Subject-wise marks for a published exam at Dawn Breakers School." },
      { property: "og:title", content: "Exam result — Dawn Breakers School" },
      { property: "og:description", content: "Subject-wise marks, totals and percentage." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExamResultPage,
});

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function ExamResultPage() {
  const { studentId, examId } = Route.useParams();
  const query = useQuery({
    queryKey: ["parent", "exam-result", studentId, examId],
    queryFn: () => getStudentExamResult({ data: { studentId, examId } }),
  });

  const back = (
    <Link to="/parent/academics" className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal">
      <ArrowLeft className="size-4" /> Academics
    </Link>
  );

  if (query.isLoading) return <LoadingCards count={2} />;
  if (query.isError)
    return <ErrorState title="We couldn't load this result" onRetry={() => void query.refetch()} />;

  const d = query.data!;
  if (!d.student || !d.exam || d.exam.status !== "published" || d.results.length === 0)
    return (
      <div className="space-y-4">
        {back}
        <EmptyState title="Result not available" description="This result isn't published or isn't linked to your account." />
      </div>
    );

  const s = d.summary!;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {back}
        <Button onClick={() => window.print()}>
          <Printer className="size-4" /> Print Marksheet
        </Button>
      </div>
      <PrintableMarksheet exam={d.exam} student={d.student} classInfo={d.classInfo} results={d.results} summary={s} />
      <header>
        <h1 className="page-title">{d.exam.name}</h1>
        <p className="meta-text mt-1.5">
          {d.student.full_name}
          {d.className ? ` · Class ${d.className}` : ""} · {d.exam.academic_year}
        </p>
      </header>

      <section className="card-surface divide-y divide-border">
        {d.results.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
            <span className="text-sm text-foreground">{r.subject_name}</span>
            <span className="text-sm font-bold text-foreground">
              {r.status === "present" && r.marks_obtained !== null
                ? `${fmt(r.marks_obtained)} / ${fmt(r.maximum_marks)}`
                : r.status === "absent"
                  ? "Absent"
                  : "Not applicable"}
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 px-5 py-3">
          <span className="text-sm font-bold text-foreground">Total</span>
          <span className="text-sm font-bold text-foreground">
            {fmt(s.obtained)} / {fmt(s.maximum)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 px-5 py-3">
          <span className="text-sm font-bold text-foreground">Percentage</span>
          <span className="metric-number text-lg text-foreground">{s.percent !== null ? `${s.percent}%` : "—"}</span>
        </div>
      </section>

      {s.absent > 0 || s.notApplicable > 0 ? (
        <p className="meta-text">
          Absent and not-applicable subjects are not counted as zero and are left out of the total.
        </p>
      ) : null}
      {!s.complete ? (
        <p className="meta-text">Some subjects have no marks recorded yet, so no final percentage is shown.</p>
      ) : null}
    </div>
  );
}
