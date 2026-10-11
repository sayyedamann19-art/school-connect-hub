import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Link2, Phone, Search } from "lucide-react";
import { useState } from "react";

import { PageHeader, SectionCard } from "@/components/common/section-card";
import { EmptyState, ErrorState, LoadingCards } from "@/components/common/states";
import { StatusBadge } from "@/components/common/status-badge";
import { RoleGate } from "@/components/layout/role-gate";
import { Input } from "@/components/ui/input";
import { listMyClassParents } from "@/lib/teacher-parents.functions";

export const Route = createFileRoute("/_authenticated/teacher/parents")({
  head: () => ({
    meta: [
      { title: "Parents of my classes — Dawn Breakers School Teacher" },
      {
        name: "description",
        content: "Parent contacts for students in the classes you teach.",
      },
      { property: "og:title", content: "Parents of my classes — Dawn Breakers School" },
      { property: "og:description", content: "Parent contacts for students in your classes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <RoleGate role="teacher">
      <TeacherParents />
    </RoleGate>
  ),
});

function TeacherParents() {
  const [search, setSearch] = useState("");
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["teacher", "parents"],
    queryFn: () => listMyClassParents(),
  });

  if (isLoading) return <LoadingCards count={3} />;
  if (isError) {
    return (
      <ErrorState
        title="We couldn't load parents"
        description="Please try again in a moment."
        onRetry={() => void refetch()}
      />
    );
  }

  const term = search.trim().toLowerCase();
  const parents = (data ?? []).filter(
    (p) =>
      !term ||
      p.name.toLowerCase().includes(term) ||
      (p.phone ?? "").includes(term) ||
      p.children.some(
        (c) => c.fullName.toLowerCase().includes(term) || c.grNumber.toLowerCase().includes(term),
      ),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parents"
        description="Parents linked to students in the classes you teach."
      />
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search parent, phone, student or GR number"
          className="pl-9"
          aria-label="Search parents"
        />
      </div>
      <SectionCard title={`${parents.length} parent${parents.length === 1 ? "" : "s"}`}>
        {parents.length === 0 ? (
          <EmptyState
            title={term ? "No parents match your search" : "No linked parents yet"}
            description={
              term
                ? "Try a different name, phone or GR number."
                : "Parents appear here once they are linked to a student in your class."
            }
            icon={<Link2 className="size-5" strokeWidth={1.75} />}
          />
        ) : (
          <ul className="divide-y divide-border">
            {parents.map((parent) => (
              <li key={parent.parentId} className="space-y-2 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{parent.name}</span>
                  {parent.phone ? (
                    <a
                      href={`tel:${parent.phone}`}
                      className="inline-flex items-center gap-1 text-sm text-primary"
                    >
                      <Phone className="size-3.5" /> {parent.phone}
                    </a>
                  ) : (
                    <span className="meta-text">No phone on file</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {parent.children.map((child) => (
                    <StatusBadge key={child.studentId} tone="info">
                      {child.fullName} · GR {child.grNumber}
                      {child.classLabel ? ` · ${child.classLabel}` : ""}
                    </StatusBadge>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
