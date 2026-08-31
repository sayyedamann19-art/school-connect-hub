import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { StudentAvatar } from "@/components/common/student-card";
import { children } from "@/lib/mock/school-data";

export const Route = createFileRoute("/_authenticated/parent/children")({
  head: () => ({
    meta: [
      { title: "My children — Dawn Breakers School" },
      {
        name: "description",
        content:
          "All children linked to your Dawn Breakers School parent account, with attendance and character card progress at a glance.",
      },
      { property: "og:title", content: "My children — Dawn Breakers School" },
      {
        property: "og:description",
        content: "Every child linked to your parent account in one place.",
      },
    ],
  }),
  component: ChildrenPage,
});

function ChildrenPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="page-title">My children</h1>
        <p className="meta-text mt-1.5">
          {children.length} student{children.length === 1 ? "" : "s"} linked to this account.
        </p>
      </header>

      <div className="space-y-3">
        {children.map((child) => (
          <Link
            key={child.id}
            to="/parent/attendance"
            className="card-surface flex items-center gap-4 p-4 transition-shadow hover:shadow-[var(--shadow-card-hover)]"
          >
            <StudentAvatar name={child.name} tone={child.photoTone} className="size-14" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-foreground">{child.name}</p>
              <p className="meta-text mt-0.5">
                Class {child.className}-{child.division} · Roll {child.rollNumber}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-4">
                <span className="text-xs font-bold text-teal">
                  {child.attendancePercent}%{" "}
                  <span className="font-medium text-muted-foreground">attendance</span>
                </span>
                <span className="text-xs font-bold text-warning-foreground">
                  {child.characterScore}{" "}
                  <span className="font-medium text-muted-foreground">character points</span>
                </span>
              </div>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
          </Link>
        ))}
      </div>

      <p className="meta-text">
        Siblings are grouped under one login. Contact the school office if a child is missing.
      </p>
    </div>
  );
}
