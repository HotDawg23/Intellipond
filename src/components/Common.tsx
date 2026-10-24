import { Button } from "@/components/ui/button";

export const PageHeader = ({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) => (
  <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
    <div className="min-w-0">
      <h1 className="break-words text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
      {subtitle && <p className="mt-1.5 break-words text-muted-foreground">{subtitle}</p>}
    </div>
    {actions && <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0">{actions}</div>}
  </div>
);

export const EmptyState = ({ icon: Icon, title, description }: { icon: React.ComponentType<{ className?: string }>; title: string; description?: string }) => (
  <div className="flex flex-col items-center justify-center py-16 px-6 text-center rounded-2xl border border-dashed border-border bg-muted/20">
    <div className="h-14 w-14 rounded-2xl bg-secondary grid place-items-center mb-4">
      <Icon className="h-6 w-6 text-accent" />
    </div>
    <h3 className="font-medium text-base">{title}</h3>
    {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
  </div>
);

export const LoadingState = ({ label }: { label: string }) => (
  <div role="status" aria-label={label} className="flex min-h-48 flex-col justify-center gap-3 p-6">
    <span className="sr-only">{label}</span>
    <div aria-hidden="true" className="space-y-3">
      <div className="h-4 w-1/3 rounded bg-muted" />
      <div className="h-3 w-2/3 rounded bg-muted/70" />
      <div className="h-3 w-1/2 rounded bg-muted/70" />
    </div>
  </div>
);

export const LoadError = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive-text">
    <span>{message}</span>
    <Button type="button" variant="outline" size="sm" onClick={onRetry}>Retry</Button>
  </div>
);
