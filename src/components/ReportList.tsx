import { Link } from "react-router-dom";
import { format } from "date-fns";
import { FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/Common";
import { getReportSnapshot, type Report } from "@/lib/report-snapshot";

export const ReportList = ({
  reports, basePath, onManageAccess,
}: {
  reports: Report[];
  basePath: string;
  onManageAccess?: (report: Report) => void;
}) => {
  if (reports.length === 0) {
    return <Card className="p-6"><EmptyState icon={FileText} title="No reports yet." description="Reports will appear here when they are available." /></Card>;
  }

  return (
    <Card className="divide-y divide-border overflow-hidden border-border/70 shadow-sm">
      {reports.map(report => {
        const snapshot = getReportSnapshot(report);
        return (
          <div key={report.id} className="flex flex-col gap-3 p-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:gap-4 sm:p-5">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300">
              <FileText className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <Link to={`${basePath}/${report.id}`} className="font-semibold text-foreground hover:text-primary hover:underline">
                {report.title}
              </Link>
              <p className="mt-1 text-sm text-muted-foreground">
                {snapshot
                  ? `${snapshot.pond_name}${snapshot.batch_name ? ` · ${snapshot.batch_name}` : ""} · ${report.period_start} to ${report.period_end}`
                  : report.description || "Older report entry"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Created {format(new Date(report.created_at), "MMM d, yyyy · h:mm a")}
                {onManageAccess && <span> · {report.published_at ? "Shared" : "Admin only"}</span>}
              </p>
            </div>
            {onManageAccess && snapshot && (
              <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => onManageAccess(report)}>
                Manage access
              </Button>
            )}
          </div>
        );
      })}
    </Card>
  );
};
