import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ChevronDown, Loader2, Plus, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveClassTemplate, type Subject, type TemplateItem } from "@/lib/academics.functions";

type Row = { subjectId: string; max: string };

/** Per-class default subject format. Changing it never touches recorded marks. */
export function SubjectTemplateEditor({
  classId,
  classLabel,
  subjects,
  template,
  loading,
}: {
  classId: string;
  classLabel: string;
  subjects: Subject[];
  template: TemplateItem[];
  loading: boolean;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [pick, setPick] = useState("");

  useEffect(() => {
    setRows(template.map((t) => ({ subjectId: t.subject_id, max: String(t.maximum_marks) })));
  }, [template, classId]);

  const name = (id: string) => subjects.find((s) => s.id === id)?.name ?? "Subject";
  const available = subjects.filter((s) => s.is_active && !rows.some((r) => r.subjectId === s.id));
  const invalid = rows.some((r) => !(Number(r.max) > 0 && Number(r.max) <= 1000));

  const save = useMutation({
    mutationFn: () =>
      saveClassTemplate({ data: { classId, items: rows.map((r) => ({ subjectId: r.subjectId, maxMarks: Number(r.max) })) } }),
    onSuccess: () => {
      toast.success("Subject format saved", { description: "Existing marks were kept as they are." });
      void qc.invalidateQueries({ queryKey: ["academics", "template", classId] });
      void qc.invalidateQueries({ queryKey: ["parent"] });
    },
    onError: (e: Error) => toast.error("Subject format not saved", { description: e.message }),
  });

  const move = (i: number, d: number) =>
    setRows((prev) => {
      const next = [...prev];
      const j = i + d;
      if (j < 0 || j >= next.length) return prev;
      const tmp = next[i]!;
      next[i] = next[j]!;
      next[j] = tmp;
      return next;
    });

  return (
    <section className="card-surface p-4">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 text-left">
        <span>
          <span className="block text-sm font-bold text-foreground">Subject format for {classLabel}</span>
          <span className="meta-text">
            {loading
              ? "Loading…"
              : template.length > 0
                ? `${template.length} subjects · used for every student in this class`
                : "Not set — all active subjects are used"}
          </span>
        </span>
        <ChevronDown className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="mt-4 space-y-3">
          <ul className="divide-y divide-border rounded-lg border border-border">
            {rows.length === 0 ? <li className="meta-text px-3 py-3">No subjects added yet.</li> : null}
            {rows.map((r, i) => (
              <li key={r.subjectId} className="flex items-center gap-2 px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">{name(r.subjectId)}</span>
                <Input
                  aria-label={`Maximum marks for ${name(r.subjectId)}`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={1000}
                  value={r.max}
                  onChange={(e) => setRows((p) => p.map((x, k) => (k === i ? { ...x, max: e.target.value } : x)))}
                  className="h-9 w-20 px-2 text-center"
                />
                <Button size="icon" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp className="size-4" />
                </Button>
                <Button size="icon" variant="ghost" aria-label="Move down" disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown className="size-4" />
                </Button>
                <Button size="icon" variant="ghost" aria-label={`Remove ${name(r.subjectId)}`} onClick={() => setRows((p) => p.filter((_, k) => k !== i))}>
                  <X className="size-4" />
                </Button>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={pick} onValueChange={setPick}>
              <SelectTrigger className="w-full sm:flex-1"><SelectValue placeholder="Choose a subject to add" /></SelectTrigger>
              <SelectContent>
                {available.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              disabled={!pick}
              onClick={() => { setRows((p) => [...p, { subjectId: pick, max: "100" }]); setPick(""); }}
            >
              <Plus className="size-4" /> Add subject
            </Button>
          </div>

          <p className="meta-text">Changes apply to mark entry from now on. Marks already recorded are never deleted.</p>
          <Button className="w-full sm:w-auto" disabled={save.isPending || invalid} onClick={() => save.mutate()}>
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save subject format
          </Button>
        </div>
      ) : null}
    </section>
  );
}
