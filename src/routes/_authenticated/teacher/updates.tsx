import { createFileRoute } from "@tanstack/react-router";

import { RoleGate } from "@/components/layout/role-gate";
import { UpdatesManager } from "@/components/updates/updates-manager";

export const Route = createFileRoute("/_authenticated/teacher/updates")({
  head: () => ({
    meta: [
      { title: "School updates — Dawn Breakers School Teacher Area" },
      {
        name: "description",
        content:
          "Write, publish and withdraw school notices that parents see in the Updates area of the app.",
      },
      { property: "og:title", content: "School updates — Dawn Breakers School Teacher Area" },
      {
        property: "og:description",
        content: "Publish school notices for parents at Dawn Breakers School.",
      },
    ],
  }),
  component: () => (
    <RoleGate role="teacher">
      <UpdatesManager scope="teacher" />
    </RoleGate>
  ),
});
