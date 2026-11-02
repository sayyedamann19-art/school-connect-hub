import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getStaffStudentProfile,
  getStaffStudentHistory,
  type RecordSection,
} from "@/lib/staff-student-records.functions";

const tabs = [
  ["profile", "Profile"],
  ["attendance", "Attendance"],
  ["feedback", "Feedback"],
  ["character", "Character card"],
  ["results", "Exam results"],
] as const;
type Section = "profile" | RecordSection;

/** The caller keys this dialog by student ID, resetting tabs and pagination on a student switch. */
export function StaffStudentRecordDialog({
  studentId,
  onClose,
}: {
  studentId: string;
  onClose: () => void;
}) {
  const [section, setSection] = useState<Section>("profile");
  const [page, setPage] = useState(0);
  const profile = useQuery({
    queryKey: ["staff-student-record", studentId, "profile"],
    queryFn: () => getStaffStudentProfile({ data: { studentId } }),
    gcTime: 0,
    retry: false,
  });
  const history = useQuery({
    queryKey: ["staff-student-record", studentId, section, page],
    queryFn: () =>
      getStaffStudentHistory({ data: { studentId, section: section as RecordSection, page } }),
    enabled: section !== "profile" && Boolean(profile.data) && !profile.isError,
    gcTime: 0,
    retry: false,
  });
  const student = profile.data?.student;
  const date = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "UTC" }).format(
          new Date(`${value}T00:00:00Z`),
        )
      : "Not recorded";

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Student record{student ? ` — ${student.full_name}` : ""}</DialogTitle>
          <DialogDescription>
            {student
              ? `GR ${student.gr_number} · Roll ${student.roll_number ?? "—"}`
              : "Read-only student records"}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 space-y-4 overflow-y-auto">
          {profile.isPending ? (
            <p role="status">Loading student record…</p>
          ) : profile.isError ? (
            <div role="alert" className="space-y-2">
              <p>{profile.error.message}</p>
              <Button variant="outline" onClick={() => void profile.refetch()}>
                Retry
              </Button>
            </div>
          ) : student ? (
            <>
              <nav aria-label="Student record sections" className="flex flex-wrap gap-2">
                {tabs.map(([value, label]) => (
                  <Button
                    key={value}
                    size="sm"
                    variant={section === value ? "default" : "outline"}
                    aria-pressed={section === value}
                    onClick={() => {
                      setSection(value);
                      setPage(0);
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </nav>
              {section === "profile" ? (
                <div className="space-y-4">
                  {profile.data.photoUrl ? (
                    <img
                      src={profile.data.photoUrl}
                      alt={`${student.full_name}'s photo`}
                      className="h-24 w-24 rounded-lg object-cover"
                    />
                  ) : null}
                  <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                    {[
                      ["Full name", student.full_name],
                      ["GR number", student.gr_number],
                      ["Roll number", student.roll_number],
                      [
                        "Class / division",
                        student.class
                          ? `${student.class.name}${student.class.division ? `-${student.class.division}` : ""}`
                          : null,
                      ],
                      ["Academic year", student.class?.academic_year],
                      ["Date of birth", date(student.date_of_birth)],
                      ["Height", student.height_cm == null ? null : `${student.height_cm} cm`],
                      ["Weight", student.weight_kg == null ? null : `${student.weight_kg} kg`],
                      ["Status", student.is_active ? "Studying" : "Left / inactive"],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="break-words font-medium">{value || "Not recorded"}</dd>
                      </div>
                    ))}
                  </dl>
                  <section className="space-y-2 border-t border-border pt-4">
                    <h3 className="font-semibold">Linked parent contacts</h3>
                    {profile.data.parents.length ? (
                      <ul className="space-y-2">
                        {profile.data.parents.map((parent, index) => (
                          <li key={index} className="text-sm">
                            {parent.full_name || "Parent"} · {parent.phone || "No phone recorded"}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">No parent linked.</p>
                    )}
                  </section>
                </div>
              ) : history.isPending || history.isFetching ? (
                <p role="status">
                  Loading {tabs.find(([value]) => value === section)?.[1].toLowerCase()}…
                </p>
              ) : history.isError ? (
                <div role="alert" className="space-y-2">
                  <p>{history.error.message}</p>
                  <Button variant="outline" onClick={() => void history.refetch()}>
                    Retry
                  </Button>
                </div>
              ) : history.data?.studentId === studentId && history.data.section === section ? (
                <>
                  {history.data.records.length ? (
                    <ul className="space-y-3">
                      {history.data.records.map((record) => (
                        <li
                          key={record.id}
                          className="space-y-2 rounded-lg border border-border p-3"
                        >
                          <div className="flex flex-wrap justify-between gap-2">
                            <h3 className="font-medium">{record.title}</h3>
                            <span className="text-sm font-semibold capitalize">{record.value}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">{date(record.date)}</p>
                          {record.detail ? (
                            <p className="whitespace-pre-wrap break-words text-sm">
                              {record.detail}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No records in this section.</p>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 0}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <span className="text-sm">Page {page + 1}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!history.data.hasMore}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </>
              ) : null}
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
