import { createFileRoute } from "@tanstack/react-router";

import { ManageClass } from "@/components/classes/manage-class";
import { RoleGate } from "@/components/layout/role-gate";

export const Route = createFileRoute("/_authenticated/admin/manage-class/$classId")({
  head: () => ({
    meta: [
      { title: "Manage class — Dawn Breakers School Admin" },
      { name: "description", content: "Import students into this class from Excel and download the class template." },
      { property: "og:title", content: "Manage class — Dawn Breakers School Admin" },
      { property: "og:description", content: "Import students into this class from Excel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { classId } = Route.useParams();
  return (
    <RoleGate role="admin">
      <ManageClass classId={classId} scope="admin" />
    </RoleGate>
  );
}
