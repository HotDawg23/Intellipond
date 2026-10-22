import { format } from "date-fns";
import { Activity, AlertTriangle, Bell, Calendar, CheckCircle2, Clock, Lightbulb, Siren, Waves } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { AlertRecord } from "@/lib/alerts";
import { formatAlertReading, getAlertConditionLabel, getAlertStatusLabel } from "@/lib/alerts";

type AlertIncidentCardProps = {
  alert: AlertRecord;
  pondName?: string;
  canAcknowledge?: boolean;
  acknowledging?: boolean;
  onAcknowledge?: () => void;
  useCoolveticaForStatus?: boolean;
  useBitcountGridForReading?: boolean;
};

const AlertIncidentCard = ({ alert, pondName, canAcknowledge = false, acknowledging = false, onAcknowledge, useCoolveticaForStatus = false, useBitcountGridForReading = false }: AlertIncidentCardProps) => {
  const isCritical = alert.severity === "critical";
  const SeverityIcon = isCritical ? Siren : alert.severity === "warning" ? AlertTriangle : Bell;
  const accent = alert.status === "legacy_archived"
    ? "border-l-slate-300 dark:border-l-slate-700"
    : alert.status === "resolved"
      ? "border-l-emerald-500"
      : isCritical
        ? "border-l-destructive"
        : "border-l-amber-500";
  const iconStyle = alert.status === "legacy_archived" || alert.status === "resolved"
    ? "bg-muted text-muted-foreground"
    : isCritical
      ? "bg-destructive/10 text-destructive"
      : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
  const acknowledged = alert.status === "active" && alert.acknowledged;

  return (
    <Card className={`group overflow-hidden border-border/70 border-l-4 bg-gradient-to-br from-card via-card to-muted/30 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${accent}`}>
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:p-5">
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${iconStyle}`}>
          <SeverityIcon className="h-5 w-5" aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={`border-0 text-[10px] uppercase ${useCoolveticaForStatus ? "font-coolvetica" : ""}`} variant={isCritical ? "destructive" : "secondary"}>{alert.severity}</Badge>
            <Badge
              variant="outline"
              aria-live="polite"
              className={`text-[10px] ${useCoolveticaForStatus ? "font-coolvetica" : ""} ${acknowledged ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : ""}`}
            >
              {acknowledged && <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden="true" />}
              {getAlertStatusLabel(alert)}
            </Badge>
            <span className="text-xs font-medium text-muted-foreground">{getAlertConditionLabel(alert.condition_key)}</span>
          </div>

          <div>
            <h2 className="text-base font-semibold leading-snug tracking-tight sm:text-lg">{alert.message}</h2>
            {pondName && (
              <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <Waves className="h-3.5 w-3.5" aria-hidden="true" />
                {pondName}
              </p>
            )}
          </div>

          {formatAlertReading(alert) && (
            <div className="inline-flex items-center gap-2 rounded-lg border border-border/70 bg-background/80 px-3 py-2 text-sm">
              <Activity className="h-4 w-4 text-primary" aria-hidden="true" />
              <span className="text-muted-foreground">Latest reading</span>
              <span className={`font-semibold text-foreground ${useBitcountGridForReading ? "font-bitcount-grid-single" : ""}`}>{formatAlertReading(alert)}</span>
            </div>
          )}

          {alert.recommendation && (
            <div className="flex gap-2.5 rounded-xl border border-cyan-200/70 bg-cyan-50/70 px-3.5 py-3 text-sm dark:border-cyan-900/70 dark:bg-cyan-950/30">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700 dark:text-cyan-300" aria-hidden="true" />
              <div className="min-w-0">
                <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-cyan-800 dark:text-cyan-200">Recommended action</p>
                <p className="leading-relaxed text-foreground/85">{alert.recommendation}</p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border/60 pt-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              Raised {format(new Date(alert.created_at), "MMM d, yyyy · HH:mm")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              Last detected {format(new Date(alert.last_detected_at ?? alert.created_at), "MMM d, yyyy · HH:mm")}
            </span>
            {alert.acknowledged_at && (
              <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                Acknowledged {format(new Date(alert.acknowledged_at), "MMM d, yyyy · HH:mm")}
              </span>
            )}
          </div>
        </div>

        {canAcknowledge && alert.status === "active" && !alert.acknowledged && (
          <Button
            size="sm"
            variant="outline"
            disabled={acknowledging}
            onClick={onAcknowledge}
            className="shrink-0 border-primary/30 text-primary transition-colors hover:bg-primary hover:text-primary-foreground sm:mt-0.5"
          >
            {acknowledging ? "Saving…" : "Acknowledge"}
          </Button>
        )}
      </div>
    </Card>
  );
};

export default AlertIncidentCard;
