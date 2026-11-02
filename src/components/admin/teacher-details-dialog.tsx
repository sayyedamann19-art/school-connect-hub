import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminUpdateTeacherDetails, type AdminTeacher, type AdminClass } from "@/lib/admin.functions";
import { displayTeacherJoiningDate } from "@/lib/teacher-details-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Admin teacher details; employment edits do not alter account or assignment data. */
export function TeacherDetailsDialog({ teacher, classes, onClose }: {
  teacher: AdminTeacher | null;
  classes: AdminClass[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [joiningDate, setJoiningDate] = useState(teacher?.joining_date ?? "");
  const [qualification, setQualification] = useState(teacher?.educational_qualification ?? "");
  const mutation = useMutation({
    mutationFn: () => adminUpdateTeacherDetails({ data: {
      teacherId: teacher!.id,
      joiningDate: joiningDate || null,
      educationalQualification: qualification.trim() || null,
    } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "teachers"] });
      toast.success("Teacher details updated");
      setEditing(false);
    },
    onError: (error) => toast.error("Couldn't save teacher details", {
      description: error instanceof Error ? error.message : "Please try again.",
    }),
  });
  if (!teacher) return null;
  const yearByClass = new Map(classes.map((schoolClass) => [schoolClass.id, schoolClass.academic_year]));
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !mutation.isPending) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Teacher details</DialogTitle>
          <DialogDescription>{teacher.name}</DialogDescription>
        </DialogHeader>

        <section aria-label="Personal details" className="space-y-3">
          <h3 className="font-semibold">Personal details</h3>
          <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-muted-foreground">Full name</dt><dd className="break-words font-medium">{teacher.name}</dd></div>
            <div><dt className="text-muted-foreground">Teacher code</dt><dd className="font-medium">{teacher.employee_code || "Not recorded"}</dd></div>
            <div><dt className="text-muted-foreground">Phone number</dt><dd className="font-medium">{teacher.phone || "Not recorded"}</dd></div>
            <div><dt className="text-muted-foreground">Status</dt><dd><Badge variant="outline">{teacher.is_active ? "Active" : "Inactive"}</Badge></dd></div>
          </dl>
        </section>

        <section aria-label="Employment details" className="space-y-3 border-t border-border pt-4">
          <h3 className="font-semibold">Employment details</h3>
          {editing ? (
            <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>
              <div className="space-y-2">
                <Label htmlFor="teacher-joining-date">Date of joining</Label>
                <Input id="teacher-joining-date" type="date" value={joiningDate}
                  disabled={mutation.isPending} onChange={(event) => setJoiningDate(event.target.value)} />
                <p className="text-sm text-muted-foreground">Enter the actual joining date. Leave blank if unknown.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="teacher-qualification">Educational qualification</Label>
                <Input id="teacher-qualification" value={qualification} maxLength={200}
                  placeholder="B.Ed., M.Sc. Mathematics" disabled={mutation.isPending}
                  onChange={(event) => setQualification(event.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Saving…" : "Save details"}</Button>
                <Button type="button" variant="ghost" disabled={mutation.isPending} onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </form>
          ) : (
            <>
              <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <div><dt className="text-muted-foreground">Date of joining</dt><dd className="font-medium">{displayTeacherJoiningDate(teacher.joining_date)}</dd></div>
                <div><dt className="text-muted-foreground">Educational qualification</dt><dd className="break-words font-medium">{teacher.educational_qualification || "Not recorded"}</dd></div>
              </dl>
              <Button variant="outline" size="sm" onClick={() => {
                setJoiningDate(teacher.joining_date ?? "");
                setQualification(teacher.educational_qualification ?? "");
                setEditing(true);
              }}>Edit employment details</Button>
            </>
          )}
        </section>

        <section aria-label="Teaching assignments" className="space-y-3 border-t border-border pt-4">
          <h3 className="font-semibold">Classes and subjects</h3>
          {teacher.classes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No classes or subjects assigned yet.</p>
          ) : (
            <ul className="space-y-3">
              {teacher.classes.map((assignment) => (
                <li key={assignment.assignmentId} className="rounded-lg border border-border p-3">
                  <p className="font-medium">{assignment.label}</p>
                  <dl className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
                    <div><dt className="text-muted-foreground">Academic year</dt><dd>{yearByClass.get(assignment.classId) || "Not available"}</dd></div>
                    <div><dt className="text-muted-foreground">Subject</dt><dd className="break-words">{assignment.subject || "Not specified"}</dd></div>
                    <div><dt className="text-muted-foreground">Teaching role</dt><dd>{assignment.isClassTeacher ? "Class teacher" : "Assigned teacher"}</dd></div>
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </section>
        <DialogFooter><Button variant="outline" disabled={mutation.isPending} onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

