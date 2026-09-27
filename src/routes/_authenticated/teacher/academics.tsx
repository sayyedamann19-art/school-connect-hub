import { createFileRoute } from "@tanstack/react-router";

import { ResultsEntry } from "@/components/academics/results-entry";
import { RoleGate } from "@/components/layout/role-gate";

export const Route = createFileRoute("/_authenticated/teacher/academics")({
  head: () => ({
    meta: [
      { title: "Exam results — Dawn Breakers School" },
      { name: "description", content: "Enter and correct exam marks for students in your assigned classes." },
      { property: "og:title", content: "Exam results — Dawn Breakers School" },
      { property: "og:description", content: "Enter exam marks for your assigned classes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RoleGate role="teacher">
      <div className="space-y-6">
        <header>
          <h1 className="page-title">Exam results</h1>
          <p className="meta-text mt-1.5">Enter marks for your assigned classes. Saved as a draft until published.</p>
        </header>
        <ResultsEntry />
      </div>
    </RoleGate>
  ),
});
