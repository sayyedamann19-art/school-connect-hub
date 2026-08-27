import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { PageHeader, SectionCard } from "@/components/common/section-card";
import { ErrorState, LoadingCards } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { downloadStudentTemplate, parseStudentWorkbook } from "@/lib/excel-workbook";
import { getImportContext, runStudentImport } from "@/lib/import.functions";
import { summarise, validateRows, type RawRow, type ValidatedRow } from "@/lib/student-import";

type Stage = "upload" | "preview" | "done";

type ImportResult = Awaited<ReturnType<typeof runStudentImport>>;

export function StudentImportWizard({ scope }: { scope: "admin" | "teacher" }) {
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("upload");
  const [fileName, setFileName] = useState("");
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [rows, setRows] = useState<ValidatedRow[]>([]);
  const [rawRows, setRawRows] = useState<RawRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const contextQuery = useQuery({
    queryKey: ["import", "context", scope],
    queryFn: () => getImportContext(),
    staleTime: 30_000,
  });

  const importMutation = useMutation({
    mutationFn: (validRows: RawRow[]) =>
      runStudentImport({ data: { fileName, rows: validRows } }),
    onSuccess: (data) => {
      setResult(data);
      setStage("done");
      void queryClient.invalidateQueries({ queryKey: ["students"] });
      void queryClient.invalidateQueries({ queryKey: ["import"] });
      toast.success("Import finished", {
        description: `${data.created} added, ${data.updated} updated, ${data.failed} skipped.`,
      });
    },
    onError: (error) => {
      toast.error("Import failed", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    },
  });

  async function handleFile(file: File) {
    if (!contextQuery.data) return;
    setParsing(true);
    setResult(null);
    try {
      const parsed = await parseStudentWorkbook(file);
      setFileName(file.name);
      const errors = [...parsed.fileErrors];
      if (parsed.unexpectedColumns.length) {
        errors.push(`Unexpected column(s) found: ${parsed.unexpectedColumns.join(", ")}.`);
      }
      setFileErrors(errors);
      if (errors.length) {
        setRows([]);
        setRawRows([]);
        setStage("upload");
        return;
      }
      setRawRows(parsed.rows);
      setRows(
        validateRows(parsed.rows, {
          existingByGr: contextQuery.data.existingByGr,
          allowedClassKeys: contextQuery.data.allowedClassKeys,
        }),
      );
      setStage("preview");
    } catch {
      setFileErrors(["This file couldn't be read. Please use the official template."]);
    } finally {
      setParsing(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  if (contextQuery.isLoading) return <LoadingCards count={2} />;
  if (contextQuery.isError) {
    return (
      <ErrorState
        title="We couldn't prepare the importer"
        description="You may not have permission to import students."
        onRetry={() => void contextQuery.refetch()}
      />
    );
  }

  const counts = summarise(rows);
  const validRawRows = rawRows.filter((raw) =>
    rows.some((row) => row.row.rowNumber === raw.rowNumber && row.action !== "error"),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import students from Excel"
        description={
          scope === "admin"
            ? "Download the official template, fill it in, then upload it. Nothing is saved until you confirm."
            : "Import students for the classes you are assigned to. Nothing is saved until you confirm."
        }
      />

      <SectionCard
        title="1. Download the template"
        description="The workbook includes a Student Data sheet and an Instructions sheet with formats and examples."
      >
        <Button variant="outline" onClick={() => void downloadStudentTemplate()}>
          <Download className="mr-2 size-4" />
          Download template
        </Button>
      </SectionCard>

      <SectionCard
        title="2. Upload the completed file"
        description="Only .xlsx files created from the official template are accepted."
      >
        <div className="space-y-3">
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <Button onClick={() => fileInput.current?.click()} disabled={parsing}>
            {parsing ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Upload className="mr-2 size-4" />
            )}
            Choose .xlsx file
          </Button>
          {fileName ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="size-4" />
              {fileName}
            </p>
          ) : null}
          {fileErrors.length ? (
            <ul className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/8 p-3 text-sm text-destructive">
              {fileErrors.map((error) => (
                <li key={error} className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  {error}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </SectionCard>

      {stage !== "upload" && rows.length > 0 ? (
        <SectionCard
          title="3. Validation report & preview"
          description="Rows with errors are never imported. Fix them in Excel and upload again."
        >
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{counts.total} rows</Badge>
              <Badge variant="secondary">{counts.create} new students</Badge>
              <Badge variant="secondary">{counts.update} updates</Badge>
              <Badge variant={counts.warnings ? "outline" : "secondary"}>
                {counts.warnings} warnings
              </Badge>
              <Badge variant={counts.errors ? "destructive" : "secondary"}>
                {counts.errors} errors
              </Badge>
            </div>

            <div className="max-h-[26rem] overflow-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>GR Number</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Parent</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((entry) => (
                    <TableRow key={entry.row.rowNumber}>
                      <TableCell className="text-muted-foreground">{entry.row.rowNumber}</TableCell>
                      <TableCell className="font-medium">{entry.row.grNumber || "—"}</TableCell>
                      <TableCell>{entry.row.fullName || "—"}</TableCell>
                      <TableCell>
                        {entry.row.className || "—"}
                        {entry.row.division ? ` ${entry.row.division}` : ""}
                      </TableCell>
                      <TableCell>
                        {entry.row.parentName || "—"}
                        <span className="block text-xs text-muted-foreground">
                          {entry.row.parentPhone || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[22rem]">
                        {entry.action === "error" ? (
                          <span className="text-sm text-destructive">
                            {entry.errors.join("; ")}
                          </span>
                        ) : (
                          <div className="space-y-1">
                            <Badge variant={entry.action === "create" ? "default" : "secondary"}>
                              {entry.action === "create" ? "Will add" : "Will update"}
                            </Badge>
                            {entry.warnings.length ? (
                              <span className="block text-xs text-muted-foreground">
                                {entry.warnings.join("; ")}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                disabled={counts.valid === 0 || importMutation.isPending}
                onClick={() => importMutation.mutate(validRawRows)}
              >
                {importMutation.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 size-4" />
                )}
                Confirm & import {counts.valid} row{counts.valid === 1 ? "" : "s"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setStage("upload");
                  setRows([]);
                  setRawRows([]);
                  setFileName("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </SectionCard>
      ) : null}

      {stage === "done" && result ? (
        <SectionCard title="4. Import summary" description={`File: ${fileName}`}>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{result.created} added</Badge>
              <Badge variant="secondary">{result.updated} updated</Badge>
              <Badge variant={result.failed ? "destructive" : "secondary"}>
                {result.failed} skipped
              </Badge>
            </div>
            {result.details.some((detail) => detail.outcome === "failed") ? (
              <ul className="space-y-1 text-sm text-destructive">
                {result.details
                  .filter((detail) => detail.outcome === "failed")
                  .map((detail) => (
                    <li key={detail.rowNumber}>
                      Row {detail.rowNumber} ({detail.grNumber || "no GR"}): {detail.message}
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Every valid row was imported. Parents can sign in with their child's GR number and
                their phone number.
              </p>
            )}
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
