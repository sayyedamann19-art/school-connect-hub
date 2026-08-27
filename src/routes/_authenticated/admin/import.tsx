import { createFileRoute } from "@tanstack/react-router";

import { RoleGate } from "@/components/layout/role-gate";
import { StudentImportWizard } from "@/components/students/import-wizard";

export const Route = createFileRoute("/_authenticated/admin/import")({
  head: () => ({
    meta: [
      { title: "Import students from Excel — School Connect Admin" },
      {
        name: "description",
        content:
          "Bulk import students with the official Excel template: download, validate, preview and confirm before anything is saved.",
      },
      { property: "og:title", content: "Import students from Excel — School Connect Admin" },
      {
        property: "og:description",
        content: "Validate and preview the official student workbook before importing.",
      },
    ],
  }),
  component: () => (
    <RoleGate role="admin">
      <StudentImportWizard scope="admin" />
    </RoleGate>
  ),
});
