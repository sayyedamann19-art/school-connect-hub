import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { StaffInbox } from "@/components/updates/staff-inbox";
import { PageHeader, SectionCard } from "@/components/common/section-card";
import { EmptyState, ErrorState, LoadingCards } from "@/components/common/states";
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
  teacherCreateUpdate,
  teacherDeleteUpdate,
  teacherListUpdates,
  teacherSetUpdatePublished,
  teacherUpdateUpdate,
  type SchoolUpdate,
} from "@/lib/updates.functions";

type Scope = "admin" | "teacher";

const api = {
  admin: {
    list: adminListUpdates,
    create: adminCreateUpdate,
    update: adminUpdateUpdate,
    setPublished: adminSetUpdatePublished,
    remove: adminDeleteUpdate,
  },
  teacher: {
    list: teacherListUpdates,
    create: teacherCreateUpdate,
    update: teacherUpdateUpdate,
    setPublished: teacherSetUpdatePublished,
    remove: teacherDeleteUpdate,
  },
} as const;

const categories = [
  { value: "notice", label: "Notice" },
  { value: "holiday", label: "Holiday" },
] as const;

export function UpdatesManager({ scope }: { scope: Scope }) {
  const fns = api[scope];
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<
    { mode: "create" } | { mode: "edit"; row: SchoolUpdate } | null
  >(null);

  const updatesQuery = useQuery({ queryKey: [scope, "updates"], queryFn: () => fns.list() });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: [scope, "updates"] });
    void queryClient.invalidateQueries({ queryKey: ["parent", "updates"] });
    void queryClient.invalidateQueries({ queryKey: ["staff", "inbox"] });
  };

  const publishMutation = useMutation({
    mutationFn: (payload: { updateId: string; isPublished: boolean }) =>
      fns.setPublished({ data: payload }),
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
    mutationFn: (updateId: string) => fns.remove({ data: { updateId } }),
    onSuccess: () => {
      toast.success("Update deleted");
      refresh();
      void queryClient.invalidateQueries({ queryKey: ["teacher", "updates"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "updates"] });
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
        description={
          scope === "admin"
            ? "Published updates appear for every parent in the Updates area. Drafts stay private."
            : "You see every published school update. You can edit, publish or delete only the updates you write."
        }
        action={
          <Button onClick={() => setDialog({ mode: "create" })} className="shrink-0">
            <Plus className="mr-2 size-4" />
            New update
          </Button>
        }
      />

      <StaffInbox />

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
              } · From ${row.sender_name}`}
              action={
                !row.can_manage ? null : (
                  <div className="flex items-center gap-2">
                    <span className="meta-text">{row.is_published ? "Live" : "Hidden"}</span>
                    <Switch
                      checked={row.is_published}
                      onCheckedChange={(checked) =>
                        publishMutation.mutate({ updateId: row.id, isPublished: checked })
                      }
                    />
                  </div>
                )
              }
            >
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                {row.body}
              </p>
              {row.can_manage ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDialog({ mode: "edit", row })}
                  >
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
              ) : null}
            </SectionCard>
          ))}
        </div>
      )}

      <UpdateDialog
        scope={scope}
        dialog={dialog}
        onClose={() => setDialog(null)}
        onSaved={refresh}
      />
    </div>
  );
}

function UpdateDialog({
  scope,
  dialog,
  onClose,
  onSaved,
}: {
  scope: Scope;
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
      const fns = api[scope];
      if (payload.title.length < 3) throw new Error("Title needs at least 3 characters.");
      if (payload.body.length < 3) throw new Error("Message needs at least 3 characters.");
      return existing
        ? fns.update({ data: { ...payload, updateId: existing.id } })
        : fns.create({ data: { ...payload, isPublished: publishNow } });
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
