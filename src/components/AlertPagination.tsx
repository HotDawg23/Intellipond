import { Button } from "@/components/ui/button";
import { ALERT_PAGE_SIZE } from "@/lib/alertFilters";
import { ArrowLeft, ArrowRight } from "lucide-react";

type Props = { page: number; total: number; onPageChange: (page: number) => void };

export default function AlertPagination({ page, total, onPageChange }: Props) {
  if (total <= ALERT_PAGE_SIZE) return null;
  return (
    <nav aria-label="Alert pages" className="flex flex-wrap items-center justify-between gap-3 pt-2 text-sm text-muted-foreground">
      <span>Showing {page * ALERT_PAGE_SIZE + 1}–{Math.min((page + 1) * ALERT_PAGE_SIZE, total)} of {total}</span>
      <div className="flex gap-2">
        <Button variant="ghost" size="icon" className="h-11 w-11 hover:bg-transparent hover:text-inherit [-webkit-tap-highlight-color:transparent]" aria-label="Previous alert page" disabled={page === 0} onClick={() => onPageChange(page - 1)}><ArrowLeft aria-hidden="true" /></Button>
        <Button variant="ghost" size="icon" className="h-11 w-11 hover:bg-transparent hover:text-inherit [-webkit-tap-highlight-color:transparent]" aria-label="Next alert page" disabled={(page + 1) * ALERT_PAGE_SIZE >= total} onClick={() => onPageChange(page + 1)}><ArrowRight aria-hidden="true" /></Button>
      </div>
    </nav>
  );
}
