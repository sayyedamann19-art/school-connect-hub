import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { adminDeleteStudent, type UnlinkedParent } from "@/lib/student-delete.functions";
import { adminDeleteParent } from "@/lib/admin.functions";

export function StudentDeleteDialog({ student, onClose }: {
  student: { id: string; full_name: string; gr_number: string } | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [parents, setParents] = useState<UnlinkedParent[]>([]);
  const refresh = () => {
    // Student records and counts are shared across staff and parent views.
    void queryClient.invalidateQueries();
  };
  const deletion = useMutation({
    mutationFn: (studentId: string) => adminDeleteStudent({ data: { studentId } }),
    onSuccess: (result) => {
      toast.success("Student deleted", { description: result.warning });
      setParents(result.parents);
      onClose();
      refresh();
    },
    onError: (error) => toast.error("Couldn't delete the student", { description: error.message }),
  });
  const parentDeletion = useMutation({
    mutationFn: (parentId: string) => adminDeleteParent({ data: { parentId, requireUnlinked: true } }),
    onSuccess: (_result, parentId) => {
      toast.success("Parent access removed");
      setParents((current) => current.filter((parent) => parent.id !== parentId));
      refresh();
    },
    onError: (error) => toast.error("Couldn't remove parent access", { description: error.message }),
  });

  return <>
    <Dialog open={student !== null} onOpenChange={(open) => { if (!open && !deletion.isPending) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {student?.full_name}?</DialogTitle>
          <DialogDescription>
            GR {student?.gr_number}. This permanently deletes this student's profile, attendance,
            feedback, character points and exam results. This cannot be undone in the app.
            Their class and teachers stay. Parents will be checked for any other linked children.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" disabled={deletion.isPending} onClick={onClose}>Cancel</Button>
          <Button variant="destructive" disabled={deletion.isPending || !student} onClick={() => { if (student) deletion.mutate(student.id); }}>
            {deletion.isPending ? "Deleting…" : "Delete student"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={parents.length > 0} onOpenChange={(open) => { if (!open && !parentDeletion.isPending) setParents([]); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Parents with no students linked</DialogTitle>
          <DialogDescription>
            These parents are no longer linked to any student. You can keep them for a future link
            or remove their parent access. This does not delete students or free their login phone number.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-3">
          {parents.map((parent) => <li key={parent.id} className="flex items-center justify-between gap-3">
            <span>{parent.name}</span>
            <Button variant="destructive" disabled={parentDeletion.isPending} onClick={() => parentDeletion.mutate(parent.id)}>
              {parentDeletion.isPending && parentDeletion.variables === parent.id ? "Removing…" : "Remove parent access"}
            </Button>
          </li>)}
        </ul>
        <DialogFooter><Button variant="ghost" disabled={parentDeletion.isPending} onClick={() => setParents([])}>Keep parents</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
