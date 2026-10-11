import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Link2, Loader2, Plus, Search, Trash2, UserPlus, Users, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader, SectionCard } from "@/components/common/section-card";
import { EmptyState, ErrorState, LoadingCards } from "@/components/common/states";
import { RoleGate } from "@/components/layout/role-gate";
import { Badge } from "@/components/ui/badge";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  adminCreateParent,
  adminDeleteParent,
  adminLinkParentStudent,
  adminListParents,
  adminSetParentActive,
  adminSetParentPassword,
  adminUnlinkParentStudent,
  type AdminParent,
} from "@/lib/admin.functions";
import { listManagedStudents } from "@/lib/students.functions";

export const Route = createFileRoute("/_authenticated/admin/parents")({
  head: () => ({
    meta: [
      { title: "Parents & family links — Dawn Breakers School Admin" },
      {
        name: "description",
        content:
          "Search parent accounts, review linked children, link or unlink students and suspend a parent login.",
      },
      { property: "og:title", content: "Parents & family links — Dawn Breakers School Admin" },
      {
        property: "og:description",
        content: "Manage parent accounts and their linked children at Dawn Breakers School.",
      },
    ],
  }),
  component: () => (
    <RoleGate role="admin">
      <ParentsAdmin />
    </RoleGate>
  ),
});

function ParentsAdmin() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [linking, setLinking] = useState<AdminParent | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<AdminParent | null>(null);

  const parentsQuery = useQuery({
    queryKey: ["admin", "parents", term],
    queryFn: () => adminListParents({ data: term ? { search: term } : {} }),
  });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["admin", "parents"] });

  const activeMutation = useMutation({
    mutationFn: (payload: { parentId: string; isActive: boolean }) =>
      adminSetParentActive({ data: payload }),
    onSuccess: (_result, variables) => {
      toast.success(variables.isActive ? "Parent login restored" : "Parent login suspended");
      refresh();
    },
    onError: (error) =>
      toast.error("Couldn't update the parent", {
        description: error instanceof Error ? error.message : undefined,
      }),
  });

  const passwordMutation = useMutation({
    mutationFn: (payload: { parentId: string; password: string }) =>
      adminSetParentPassword({ data: payload }),
    onSuccess: () => toast.success("Password changed", { description: "Share it with the parent privately." }),
    onError: (error) =>
      toast.error("Couldn't change the password", {
        description: error instanceof Error ? error.message : undefined,
      }),
  });

  const unlinkMutation = useMutation({
    mutationFn: (linkId: string) => adminUnlinkParentStudent({ data: { linkId } }),
    onSuccess: () => {
      toast.success("Child unlinked", { description: "The student record itself is unchanged." });
      refresh();
    },
    onError: (error) =>
      toast.error("Couldn't remove the link", {
        description: error instanceof Error ? error.message : undefined,
      }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parents"
        description="Parent logins and the children they can see. Unlinking a child never deletes the student."
        action={
          <Button onClick={() => setAdding(true)}>
            <UserPlus className="mr-2 size-4" />
            Add parent
          </Button>
        }
      />

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setTerm(search.trim());
        }}
      >
        <Input
          placeholder="Search by parent name, phone, student name or GR number"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Button type="submit" variant="outline">
          <Search className="mr-2 size-4" />
          Search
        </Button>
      </form>

      {parentsQuery.isLoading ? (
        <LoadingCards count={3} />
      ) : parentsQuery.isError ? (
        <ErrorState
          title="We couldn't load parents"
          description="Please try again in a moment."
          onRetry={() => void parentsQuery.refetch()}
        />
      ) : (parentsQuery.data ?? []).length === 0 ? (
        <EmptyState
          title="No parent accounts found"
          description="Parent logins are created when you add a student with a parent phone number, or during an Excel import."
          icon={<Users className="size-5" strokeWidth={1.75} />}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(parentsQuery.data ?? []).map((parent) => (
            <SectionCard
              key={parent.id}
              title={parent.name}
              description={[parent.phone ?? "No phone on record", parent.loginAlias]
                .filter(Boolean)
                .join(" · ")}
              action={
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={passwordMutation.isPending}
                    onClick={() => {
                      const password = window.prompt(`New password for ${parent.name} (at least 8 characters)`);
                      if (password === null) return;
                      if (password.length < 8 || password.length > 72) {
                        toast.error("Password must be 8–72 characters");
                        return;
                      }
                      passwordMutation.mutate({ parentId: parent.id, password });
                    }}
                  >
                    Set password
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={`Delete ${parent.name}`}
                    onClick={() => setDeleting(parent)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                  <span className="meta-text">{parent.isActive ? "Active" : "Suspended"}</span>
                  <Switch
                    checked={parent.isActive}
                    onCheckedChange={(checked) =>
                      activeMutation.mutate({ parentId: parent.id, isActive: checked })
                    }
                  />
                </div>
              }
            >
              <div className="space-y-3">
                {parent.students.length === 0 ? (
                  <p className="meta-text">No children linked yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {parent.students.map((student) => (
                      <Badge key={student.linkId} variant="outline" className="gap-1.5">
                        {student.fullName} · GR {student.grNumber}
                        {student.classLabel ? ` · ${student.classLabel}` : ""}
                        {student.isActive ? "" : " · inactive"}
                        <button
                          type="button"
                          aria-label={`Unlink ${student.fullName}`}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Remove the link between ${parent.name} and ${student.fullName}? The student record stays.`,
                              )
                            ) {
                              unlinkMutation.mutate(student.linkId);
                            }
                          }}
                        >
                          <X className="size-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <Button variant="outline" size="sm" onClick={() => setLinking(parent)}>
                  <Plus className="mr-2 size-4" />
                  Link a student
                </Button>
              </div>
            </SectionCard>
          ))}
        </div>
      )}

      <LinkStudentDialog parent={linking} onClose={() => setLinking(null)} onLinked={refresh} />
      {adding ? <AddParentDialog onClose={() => setAdding(false)} onCreated={refresh} /> : null}
      <DeleteParentDialog parent={deleting} onClose={() => setDeleting(null)} onDeleted={refresh} />
    </div>
  );
}

function LinkStudentDialog({
  parent,
  onClose,
  onLinked,
}: {
  parent: AdminParent | null;
  onClose: () => void;
  onLinked: () => void;
}) {
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [relationship, setRelationship] = useState("guardian");

  const studentsQuery = useQuery({
    queryKey: ["admin", "link-students", term],
    enabled: Boolean(parent) && term.length > 0,
    queryFn: () => listManagedStudents({ data: { search: term } }),
  });

  const mutation = useMutation({
    mutationFn: (studentId: string) =>
      adminLinkParentStudent({
        data: {
          parentId: parent!.id,
          studentId,
          ...(relationship.trim() ? { relationship: relationship.trim() } : {}),
        },
      }),
    onSuccess: () => {
      toast.success("Student linked to this parent");
      onLinked();
      onClose();
    },
    onError: (error) =>
      toast.error("Couldn't link the student", {
        description: error instanceof Error ? error.message : undefined,
      }),
  });

  if (!parent) return null;

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Link a student</DialogTitle>
          <DialogDescription>
            {parent.name} will be able to see the child you link here.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>Relationship</Label>
            <Input value={relationship} onChange={(event) => setRelationship(event.target.value)} />
          </div>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setTerm(search.trim());
            }}
          >
            <Input
              placeholder="Search by student name or GR number"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Button type="submit" variant="outline">
              <Search className="size-4" />
            </Button>
          </form>

          <div className="max-h-64 space-y-2 overflow-y-auto">
            {studentsQuery.isLoading && term ? (
              <p className="meta-text">Searching…</p>
            ) : (studentsQuery.data ?? []).length === 0 ? (
              <p className="meta-text">
                {term ? "No students matched that search." : "Search for a student to link."}
              </p>
            ) : (
              (studentsQuery.data ?? []).map((student) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {student.full_name}
                    </p>
                    <p className="meta-text">
                      GR {student.gr_number}
                      {student.class ? ` · ${student.class.name}${student.class.division ? `-${student.class.division}` : ""}` : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    disabled={mutation.isPending}
                    onClick={() => mutation.mutate(student.id)}
                  >
                    {mutation.isPending ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Link2 className="mr-2 size-4" />
                    )}
                    Link
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddParentDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [relationship, setRelationship] = useState("guardian");
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [picked, setPicked] = useState<{ id: string; label: string }[]>([]);

  const studentsQuery = useQuery({
    queryKey: ["admin", "link-students", term],
    enabled: term.length > 0,
    queryFn: () => listManagedStudents({ data: { search: term } }),
  });

  const mutation = useMutation({
    mutationFn: () =>
      adminCreateParent({
        data: {
          fullName: name.trim(),
          phone: phone.trim(),
          studentIds: picked.map((p) => p.id),
          ...(relationship.trim() ? { relationship: relationship.trim() } : {}),
        },
      }),
    onSuccess: () => {
      toast.success("Parent login created", {
        description: "They sign in with their child's GR number; the starting password is their phone number.",
      });
      onCreated();
      onClose();
    },
    onError: (error) =>
      toast.error("Couldn't add the parent", {
        description: error instanceof Error ? error.message : undefined,
      }),
  });

  const phoneOk = /^[6-9]\d{9}$/.test(phone.trim());
  const canSave = name.trim().length >= 2 && phoneOk && picked.length > 0;

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add parent</DialogTitle>
          <DialogDescription>Create a parent login and link one or more of their children.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Parent name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Phone number</Label>
              <Input inputMode="numeric" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value)} />
              {phone && !phoneOk ? <p className="meta-text text-destructive">Enter a 10-digit mobile number</p> : null}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Relationship</Label>
            <Input value={relationship} onChange={(e) => setRelationship(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Children ({picked.length})</Label>
            {picked.length ? (
              <div className="flex flex-wrap gap-2">
                {picked.map((p) => (
                  <Badge key={p.id} variant="outline" className="gap-1.5">
                    {p.label}
                    <button
                      type="button"
                      aria-label={`Remove ${p.label}`}
                      onClick={() => setPicked((prev) => prev.filter((x) => x.id !== p.id))}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="meta-text">Search and add at least one student.</p>
            )}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                setTerm(search.trim());
              }}
            >
              <Input
                placeholder="Search by student name or GR number"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Button type="submit" variant="outline">
                <Search className="size-4" />
              </Button>
            </form>
            <div className="max-h-48 space-y-2 overflow-y-auto">
              {studentsQuery.isLoading && term ? (
                <p className="meta-text">Searching…</p>
              ) : term && (studentsQuery.data ?? []).length === 0 ? (
                <p className="meta-text">No students matched that search.</p>
              ) : (
                (studentsQuery.data ?? []).map((student) => {
                  const chosen = picked.some((p) => p.id === student.id);
                  return (
                    <div
                      key={student.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{student.full_name}</p>
                        <p className="meta-text">GR {student.gr_number}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={chosen || picked.length >= 10}
                        onClick={() =>
                          setPicked((prev) => [...prev, { id: student.id, label: `${student.full_name} · GR ${student.gr_number}` }])
                        }
                      >
                        {chosen ? "Added" : "Add"}
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!canSave || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Create parent login
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteParentDialog({
  parent,
  onClose,
  onDeleted,
}: {
  parent: AdminParent | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const mutation = useMutation({
    mutationFn: () => adminDeleteParent({ data: { parentId: parent!.id, unlinkSoleChildren: confirmUnlink } }),
    onSuccess: () => {
      toast.success("Parent removed", { description: "Student records and history are unchanged." });
      setConfirmUnlink(false);
      onDeleted();
      onClose();
    },
    onError: (error) =>
      toast.error("Couldn't delete the parent", {
        description: error instanceof Error ? error.message : undefined,
      }),
  });
  if (!parent) return null;
  const sole = parent.students.filter((s) => s.otherParents === 0);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          setConfirmUnlink(false);
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete {parent.name}?</DialogTitle>
          <DialogDescription>
            This parent will lose access to the app. Students, attendance, results and history are never deleted.
          </DialogDescription>
        </DialogHeader>
        {parent.students.length === 0 ? (
          <p className="meta-text">No children are linked to this parent.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {parent.students.map((s) => (
              <li key={s.linkId} className="flex justify-between gap-3">
                <span className="text-foreground">
                  {s.fullName} · GR {s.grNumber}
                </span>
                <span className={s.otherParents ? "meta-text" : "meta-text text-destructive"}>
                  {s.otherParents ? "Another parent stays linked" : "No other parent"}
                </span>
              </li>
            ))}
          </ul>
        )}
        {sole.length ? (
          <label className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm">
            <Checkbox checked={confirmUnlink} onCheckedChange={(v) => setConfirmUnlink(v === true)} />
            <span>
              I understand {sole.length === 1 ? "this student" : `these ${sole.length} students`} will have no parent login
              until I link another parent.
            </span>
          </label>
        ) : null}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={mutation.isPending || (sole.length > 0 && !confirmUnlink)}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Delete parent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
