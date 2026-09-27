import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, ChevronRight } from "lucide-react";
import { useState } from "react";

import { EmptyState, ErrorState, LoadingCards } from "@/components/common/states";
import { ChildSwitcher } from "@/components/parent/child-switcher";
import { getStudentAcademics } from "@/lib/academics.functions";
import { getMyChildren } from "@/lib/school.functions";

export const Route = createFileRoute("/_authenticated/parent/academics/")({
  head: () => ({
    meta: [
      { title: "Academics — Dawn Breakers School" },
      { name: "description", content: "Published exam results for your child at Dawn Breakers School." },
      { property: "og:title", content: "Academics — Dawn Breakers School" },
      { property: "og:description", content: "Your child's published exam results." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AcademicsPage,
});

function AcademicsPage() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const childrenQuery = useQuery({ queryKey: ["parent", "children"], queryFn: () => getMyChildren() });
  const childrenList = childrenQuery.data?.children ?? [];
  const child = childrenList.find((c) => c.id === (activeId ?? childrenList[0]?.id)) ?? null;

  const academicsQuery = useQuery({
    queryKey: ["parent", "academics", child?.id],
    enabled: Boolean(child),
    queryFn: () => getStudentAcademics({ data: { studentId: child!.id } }),
  });

  if (childrenQuery.isLoading) return <LoadingCards count={2} />;
  if (childrenQuery.isError)
    return <ErrorState title="We couldn't load academics" description="Please try again in a moment." onRetry={() => void childrenQuery.refetch()} />;
  if (!child)
    return <EmptyState title="No children linked to your account yet" description="Please contact the school office." />;

  const years = academicsQuery.data?.years ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="page-title">Academics</h1>
        <p className="meta-text mt-1.5">{child.full_name}</p>
      </header>

      <ChildSwitcher
        childrenList={childrenList.map((c) => ({ id: c.id, full_name: c.full_name, photoUrl: c.photoUrl }))}
        activeId={child.id}
        onSelect={setActiveId}
      />

      {academicsQuery.isLoading ? (
        <LoadingCards count={4} />
      ) : academicsQuery.isError ? (
        <ErrorState title="We couldn't load results" description="Please try again in a moment." onRetry={() => void academicsQuery.refetch()} />
      ) : years.length === 0 ? (
        <EmptyState title="No exams yet" icon={<BookOpen className="size-5" strokeWidth={1.75} />} />
      ) : (
        years.map(({ year, exams }) => (
          <section key={year} className="space-y-3">
            <h2 className="section-title">{year}</h2>
            <ul className="space-y-3">
              {exams.map(({ exam, published, summary }) => {
                const body = (
                  <>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-foreground">{exam.name}</span>
                      <span className="meta-text">
                        {!published
                          ? "Not Published"
                          : !summary
                            ? "No results recorded"
                            : summary.percent !== null
                              ? "View result"
                              : "Result incomplete — view details"}
                      </span>
                    </span>
                    {published && summary?.percent != null ? (
                      <span className="metric-number text-xl text-foreground">{summary.percent}%</span>
                    ) : null}
                    {published && summary ? <ChevronRight className="size-4 text-muted-foreground" /> : null}
                  </>
                );
                return (
                  <li key={exam.id}>
                    {published && summary ? (
                      <Link
                        to="/parent/academics/$studentId/$examId"
                        params={{ studentId: child.id, examId: exam.id }}
                        className="card-surface flex items-center gap-3.5 p-4"
                      >
                        {body}
                      </Link>
                    ) : (
                      <div className="card-surface flex items-center gap-3.5 p-4 opacity-80">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
