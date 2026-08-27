import { createFileRoute } from "@tanstack/react-router";

import { RoleGate } from "@/components/layout/role-gate";
import { StudentImportWizard } from "@/components/students/import-wizard";

export const Route = createFileRoute("/_authenticated/teacher/import")({
  head: () => ({
    meta: [
      { title: "Import my class students — School Connect Teacher" },
      {
        name: "description",
        content:
          "Class teachers can import students for their assigned classes using the official Excel template, with validation and preview before saving.",
      },
      { property: "og:title", content: "Import my class students — School Connect Teacher" },
      {
        property: "og:description",
        content: "Validate and preview student rows for your assigned classes before importing.",
      },
    ],
  }),
  component: () => (
    <RoleGate role="teacher">
      <StudentImportWizard scope="teacher" />
    </RoleGate>
  ),
});
