import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { PageHeader, SectionCard } from "@/components/common/section-card";
import { EmptyState, ErrorState, LoadingCards } from "@/components/common/states";
import { RoleGate } from "@/components/layout/role-gate";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listImportHistory } from "@/lib/import.functions";

export const Route = createFileRoute("/_authenticated/admin/imports")({
  head: () => ({
    meta: [
      { title: "Import history — School Connect Admin" },
      {
        name: "description",
        content:
          "Review every student Excel import: who uploaded it, how many records were added, updated or skipped.",
      },
      { property: "og:title", content: "Import history — School Connect Admin" },
      {
        property: "og:description",
        content: "Every student import with uploader, totals and skipped rows.",
      },
    ],
  }),
  component: () => (
    <RoleGate role="admin">
      <ImportHistory />
    </RoleGate>
  ),
});

function ImportHistory() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["import", "history"],
    queryFn: () => listImportHistory(),
  });

  if (isLoading) return <LoadingCards count={2} />;
  if (isError) {
    return (
      <ErrorState
        title="We couldn't load the import history"
        description="Please try again in a moment."
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import history"
        description="A record of every Excel upload, kept for auditing."
      />
      <SectionCard contentClassName="px-0 py-0">
        {(data ?? []).length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No imports yet"
              description="Student imports will be listed here once a file has been processed."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Uploaded by</TableHead>
                  <TableHead>Rows</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Skipped</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-muted-foreground">
                      {new Date(row.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-medium">{row.file_name}</TableCell>
                    <TableCell>{row.uploadedByName}</TableCell>
                    <TableCell>{row.total_records}</TableCell>
                    <TableCell>{row.created_count}</TableCell>
                    <TableCell>{row.updated_count}</TableCell>
                    <TableCell>{row.failed_count}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          row.status === "completed"
                            ? "secondary"
                            : row.status === "failed"
                              ? "destructive"
                              : "outline"
                        }
                      >
                        {row.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
