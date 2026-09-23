import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Bell, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader, SectionCard } from "@/components/common/section-card";
import { EmptyState, ErrorState, LoadingCards } from "@/components/common/states";
import { RoleGate } from "@/components/layout/role-gate";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  adminCreateUpdate,
  adminDeleteUpdate,
  adminListUpdates,
  adminSetUpdatePublished,
  adminUpdateUpdate,
  type SchoolUpdate,
} from "@/lib/updates.functions";

export const Route = createFileRoute("/_authenticated/admin/updates")({
  head: () => ({
    meta: [
      { title: "School updates — Dawn Breakers School Admin" },
      {
        name: "description",
        content:
          "Write, publish and withdraw school notices that parents see in the Updates area of the app.",
      },
      { property: "og:title", content: "School updates — Dawn Breakers School Admin" },
      {
        property: "og:description",
        content: "Publish school notices for parents at Dawn Breakers School.",
      },
    ],
  }),
  component: () => (
    <RoleGate role="admin">
      <UpdatesAdmin />
    </RoleGate>
  ),
});

const categories = [
  { value: "notice", label: "Notice" },
  { value: "school", label: "School" },
  { value: "attendance", label: "Attendance" },
  { value: "feedback", label: "Feedback" },
] as const;

function UpdatesAdmin() {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<{ mode: "create" } | { mode: "edit"; row: SchoolUpdate } | null>(
    null,
  );

  const updatesQuery = useQuery({ queryKey: ["admin", "updates"], queryFn: () => adminListUpdates() });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "updates"] });
    void queryClient.invalidateQueries({ queryKey: ["parent", "updates"] });
  };

  const publishMutation = useMutation({
    mutationFn: (payload: { updateId: string; isPublished: boolean }) =>
      adminSetUpdatePublished({ data: payload }),
    onSuccess: (_result, variables) => {
      toast.success(variables.isPublished ? "Update published" : "Update hidden from parents");
      refresh();
    },
    onError: (error) =>
      toast.error("Couldn't change the update", {
        description: error instanceof Error ? error.message : undefined,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (updateId: string) => adminDeleteUpdate({ data: { updateId } }),
    onSuccess: () => {
      toast.success("Update deleted");
      refresh();
    },
    onError: (error) =>
      toast.error("Couldn't delete the update", {
        description: error instanceof Error ? error.message : undefined,
      }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="School updates"
        description="Published updates appear for every parent in the Updates area. Drafts stay private."
        action={
          <Button onClick={() => setDialog({ mode: "create" })}>
            <Plus className="mr-2 size-4" />
            New update
          </Button>
        }
      />

      {updatesQuery.isLoading ? (
        <LoadingCards count={3} />
      ) : updatesQuery.isError ? (
        <ErrorState
          title="We couldn't load updates"
          description="Please try again in a moment."
          onRetry={() => void updatesQuery.refetch()}
        />
      ) : (updatesQuery.data ?? []).length === 0 ? (
        <EmptyState
          title="No updates yet"
          description="Write your first notice so parents have something to read."
          icon={<Bell className="size-5" strokeWidth={1.75} />}
        />
      ) : (
        <div className="space-y-4">
          {(updatesQuery.data ?? []).map((row) => (
            <SectionCard
              key={row.id}
              title={row.title}
              description={`${categories.find((item) => item.value === row.category)?.label ?? row.category} · ${
                row.is_published ? "Published" : "Draft"
              }`}
              action={
                <div className="flex items-center gap-2">
                  <span className="meta-text">{row.is_published ? "Live" : "Hidden"}</span>
                  <Switch
                    checked={row.is_published}
                    onCheckedChange={(checked) =>
                      publishMutation.mutate({ updateId: row.id, isPublished: checked })
                    }
                  />
                </div>
              }
            >
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                {row.body}
              </p>
              <div className="mt-4 flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setDialog({ mode: "edit", row })}>
                  <Pencil className="mr-2 size-4" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (window.confirm("Delete this update permanently?")) {
                      deleteMutation.mutate(row.id);
                    }
                  }}
                >
                  <Trash2 className="mr-2 size-4" />
                  Delete
                </Button>
              </div>
            </SectionCard>
          ))}
        </div>
      )}

      <UpdateDialog dialog={dialog} onClose={() => setDialog(null)} onSaved={refresh} />
    </div>
  );
}

function UpdateDialog({
  dialog,
  onClose,
  onSaved,
}: {
  dialog: { mode: "create" } | { mode: "edit"; row: SchoolUpdate } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const existing = dialog && dialog.mode === "edit" ? dialog.row : null;
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<SchoolUpdate["category"] | "">("");
  const [publishNow, setPublishNow] = useState(true);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: (title || existing?.title || "").trim(),
        body: (body || existing?.body || "").trim(),
        category: (category || existing?.category || "notice") as SchoolUpdate["category"],
      };
      return existing
        ? adminUpdateUpdate({ data: { ...payload, updateId: existing.id } })
        : adminCreateUpdate({ data: { ...payload, isPublished: publishNow } });
    },
    onSuccess: () => {
      toast.success(existing ? "Update saved" : "Update created");
      onSaved();
      setTitle("");
      setBody("");
      setCategory("");
      setPublishNow(true);
      onClose();
    },
    onError: (error) =>
      toast.error("Couldn't save the update", {
        description: error instanceof Error ? error.message : "Please check the details.",
      }),
  });

  if (!dialog) return null;

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit update" : "New update"}</DialogTitle>
          <DialogDescription>
            Parents see published updates only. Keep the message short and clear.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              placeholder="Annual day rehearsal"
              value={title || existing?.title || ""}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              rows={5}
              maxLength={2000}
              placeholder="Rehearsals begin on Monday. Students should reach school by 8 a.m."
              value={body || existing?.body || ""}
              onChange={(event) => setBody(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={category || existing?.category || "notice"}
              onValueChange={(value) => setCategory(value as SchoolUpdate["category"])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {existing ? null : (
            <div className="flex items-center justify-between">
              <Label>Publish immediately</Label>
              <Switch checked={publishNow} onCheckedChange={setPublishNow} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            {existing ? "Save changes" : "Create update"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
