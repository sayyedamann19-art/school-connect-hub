import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ResultsEntry } from "@/components/academics/results-entry";
import { SectionCard } from "@/components/common/section-card";
import { ErrorState, LoadingCards } from "@/components/common/states";
import { StatusBadge } from "@/components/common/status-badge";
import { RoleGate } from "@/components/layout/role-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  adminCreateExam,
  adminSaveSubject,
  adminUpdateExam,
  listAcademicSetup,
} from "@/lib/academics.functions";

export const Route = createFileRoute("/_authenticated/admin/academics")({
  head: () => ({
    meta: [
      { title: "Academics — Dawn Breakers School Admin" },
      { name: "description", content: "Manage exams, subjects and publishing of exam results for parents." },
      { property: "og:title", content: "Academics — Dawn Breakers School Admin" },
      { property: "og:description", content: "Manage exams, subjects and published results." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RoleGate role="admin">
      <AcademicsAdmin />
    </RoleGate>
  ),
});

function AcademicsAdmin() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="page-title">Academics</h1>
        <p className="meta-text mt-1.5">Exams, subjects, marks and publishing.</p>
      </header>
      <Tabs defaultValue="exams">
        <TabsList>
          <TabsTrigger value="exams">Exams</TabsTrigger>
          <TabsTrigger value="marks">Marks</TabsTrigger>
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
        </TabsList>
        <TabsContent value="exams" className="mt-4"><ExamsPanel /></TabsContent>
        <TabsContent value="marks" className="mt-4"><ResultsEntry /></TabsContent>
        <TabsContent value="subjects" className="mt-4"><SubjectsPanel /></TabsContent>
      </Tabs>
    </div>
  );
}

function useSetup() {
  return useQuery({ queryKey: ["academics", "setup"], queryFn: () => listAcademicSetup() });
}

function useRefresh() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["academics"] });
    void qc.invalidateQueries({ queryKey: ["parent"] });
  };
}

function ExamsPanel() {
  const setup = useSetup();
  const refresh = useRefresh();
  const [year, setYear] = useState("2026-2027");
  const [name, setName] = useState("");
  const [order, setOrder] = useState("5");

  const create = useMutation({
    mutationFn: () => adminCreateExam({ data: { academicYear: year.trim(), name: name.trim(), displayOrder: Number(order) || 0 } }),
    onSuccess: () => { toast.success("Exam added"); setName(""); refresh(); },
    onError: (e: Error) => toast.error("Exam not added", { description: e.message }),
  });
  const update = useMutation({
    mutationFn: (v: { examId: string; name?: string; displayOrder?: number; isActive?: boolean; status?: "draft" | "published" }) => adminUpdateExam({ data: v }),
    onSuccess: () => { toast.success("Exam updated"); refresh(); },
    onError: (e: Error) => toast.error("Exam not updated", { description: e.message }),
  });

  if (setup.isLoading) return <LoadingCards count={2} />;
  if (setup.isError) return <ErrorState title="We couldn't load exams" onRetry={() => void setup.refetch()} />;
  const exams = setup.data?.exams ?? [];

  return (
    <div className="space-y-4">
      <SectionCard title="Add an exam" description="For future exam types or a new academic year.">
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr_6rem_auto]">
          <Input aria-label="Academic year" placeholder="2026-2027" value={year} onChange={(e) => setYear(e.target.value)} />
          <Input aria-label="Exam name" placeholder="Exam name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input aria-label="Display order" type="number" value={order} onChange={(e) => setOrder(e.target.value)} />
          <Button disabled={create.isPending || name.trim().length < 2} onClick={() => create.mutate()}>
            <Plus className="size-4" /> Add
          </Button>
        </div>
      </SectionCard>

      <ul className="space-y-3">
        {exams.map((exam) => (
          <li key={exam.id} className="card-surface flex flex-wrap items-center gap-3 p-4">
            <Input
              aria-label="Order"
              type="number"
              defaultValue={exam.display_order}
              className="h-9 w-16 text-center"
              onBlur={(e) => {
                const v = Number(e.target.value);
                if (v !== exam.display_order) update.mutate({ examId: exam.id, displayOrder: v });
              }}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-foreground">{exam.name}</p>
              <p className="meta-text">{exam.academic_year}</p>
            </div>
            <StatusBadge tone={exam.status === "published" ? "success" : "warning"}>
              {exam.status === "published" ? "Published" : "Draft"}
            </StatusBadge>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Active
              <Switch checked={exam.is_active} onCheckedChange={(v) => update.mutate({ examId: exam.id, isActive: v })} />
            </label>
            <Button
              size="sm"
              variant={exam.status === "published" ? "outline" : "default"}
              onClick={() => update.mutate({ examId: exam.id, status: exam.status === "published" ? "draft" : "published" })}
            >
              {exam.status === "published" ? "Unpublish" : "Publish"}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SubjectsPanel() {
  const setup = useSetup();
  const refresh = useRefresh();
  const [name, setName] = useState("");
  const save = useMutation({
    mutationFn: (v: { subjectId?: string; name?: string; displayOrder?: number; isActive?: boolean }) => adminSaveSubject({ data: v }),
    onSuccess: () => { toast.success("Subject saved"); setName(""); refresh(); },
    onError: (e: Error) => toast.error("Subject not saved", { description: e.message }),
  });

  if (setup.isLoading) return <LoadingCards count={2} />;
  if (setup.isError) return <ErrorState title="We couldn't load subjects" onRetry={() => void setup.refetch()} />;
  const subjects = setup.data?.subjects ?? [];

  return (
    <div className="space-y-4">
      <SectionCard title="Add a subject">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input aria-label="Subject name" placeholder="Subject name" value={name} onChange={(e) => setName(e.target.value)} />
          <Button
            disabled={save.isPending || name.trim().length < 2}
            onClick={() => save.mutate({ name: name.trim(), displayOrder: subjects.length + 1 })}
          >
            <Plus className="size-4" /> Add
          </Button>
        </div>
      </SectionCard>
      <ul className="card-surface divide-y divide-border">
        {subjects.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3">
            <span className="text-sm text-foreground">{s.name}</span>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Active
              <Switch checked={s.is_active} onCheckedChange={(v) => save.mutate({ subjectId: s.id, isActive: v })} />
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
