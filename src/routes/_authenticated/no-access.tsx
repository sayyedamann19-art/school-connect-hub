import { createFileRoute } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/no-access")({
  head: () => ({
    meta: [
      { title: "No access yet — School Connect" },
      {
        name: "description",
        content: "Your account has no school role assigned yet. Contact the school office.",
      },
      { property: "og:title", content: "No access yet — School Connect" },
      {
        property: "og:description",
        content: "Your account has no school role assigned yet.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NoAccessPage,
});

function NoAccessPage() {
  return (
    <div className="card-surface mx-auto max-w-md px-6 py-12 text-center">
      <div className="mx-auto mb-4 flex size-10 items-center justify-center rounded-full bg-warning-soft text-warning-foreground">
        <ShieldAlert className="size-5" />
      </div>
      <h1 className="text-lg font-semibold text-foreground">No access yet</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your account is signed in but no school role has been assigned to it. The school office
        assigns parent, teacher and administrator access.
      </p>
    </div>
  );
}
