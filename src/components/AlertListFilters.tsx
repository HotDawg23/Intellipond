import { AlertTriangle, Calendar, Siren } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AlertDateRangeFilter, AlertSeverityFilter, AlertStatusFilter } from "@/lib/alertFilters";

type AlertListFiltersProps = {
  severity: AlertSeverityFilter;
  onSeverityChange: (severity: AlertSeverityFilter) => void;
  dateRange: AlertDateRangeFilter;
  onDateRangeChange: (range: AlertDateRangeFilter) => void;
  status?: AlertStatusFilter;
  onStatusChange?: (status: AlertStatusFilter) => void;
};

const AlertListFilters = ({
  severity,
  onSeverityChange,
  dateRange,
  onDateRangeChange,
  status,
  onStatusChange,
}: AlertListFiltersProps) => {
  const showStatusFilter = status !== undefined && onStatusChange !== undefined;
  const severityFilters = [
    { value: "all" as const, label: "All", Icon: null },
    { value: "critical" as const, label: "Critical", Icon: Siren },
    { value: "warning" as const, label: "Warning", Icon: AlertTriangle },
  ];

  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <div role="group" aria-label="Filter alerts by severity" className="flex flex-wrap items-center gap-2">
        {severityFilters.map(({ value, label, Icon }) => {
          const active = severity === value;
          return (
            <Button
              key={value}
              type="button"
              variant="outline"
              aria-pressed={active}
              onClick={() => onSeverityChange(value)}
              className={`h-9 gap-2 whitespace-nowrap rounded-md px-3.5 text-sm shadow-none transition-colors ${active
                ? "border-blue-600 bg-blue-600 text-white hover:border-blue-700 hover:bg-blue-700 hover:text-white dark:border-cyan-400 dark:bg-cyan-400 dark:text-slate-950 dark:hover:border-cyan-300 dark:hover:bg-cyan-300 dark:hover:text-slate-950"
                : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-muted/60"
                }`}
            >
              {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
              {label}
            </Button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="space-y-1">
          <Label htmlFor="alert-date-range" className="text-xs font-medium text-muted-foreground">Date raised</Label>
          <Select value={dateRange} onValueChange={value => onDateRangeChange(value as AlertDateRangeFilter)}>
            <SelectTrigger id="alert-date-range" className="h-10 w-full rounded-lg bg-background sm:w-[170px]">
              <span className="mr-2 text-muted-foreground"><Calendar className="h-4 w-4" aria-hidden="true" /></span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any date</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {showStatusFilter && (
          <div className="space-y-1">
            <Label htmlFor="alert-status" className="text-xs font-medium text-muted-foreground">Status</Label>
            <Select value={status} onValueChange={value => onStatusChange(value as AlertStatusFilter)}>
              <SelectTrigger id="alert-status" className="h-10 w-full rounded-lg bg-background sm:w-[210px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="needs_acknowledgement">Needs acknowledgement</SelectItem>
                <SelectItem value="acknowledged">Acknowledged</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="legacy">Legacy</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertListFilters;
