import type { AdminTeacher, AdminClass } from "@/lib/admin.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Read-only view of information already available to the signed-in administrator. */
export function TeacherDetailsDialog({ teacher, classes, onClose }: {
  teacher: AdminTeacher | null;
  classes: AdminClass[];
  onClose: () => void;
}) {
  if (!teacher) return null;
  const yearByClass = new Map(classes.map((schoolClass) => [schoolClass.id, schoolClass.academic_year]));
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
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
        <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
