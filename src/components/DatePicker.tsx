import { useState } from "react";
import { format } from "date-fns";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type DatePickerProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

const parseDate = (value: string | undefined) => {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;

  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : undefined;
};

const toDateValue = (date: Date) => {
  const year = date.getFullYear().toString().padStart(4, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function DatePicker({
  id,
  value,
  onChange,
  min,
  max,
  required = false,
  disabled = false,
  placeholder = "Choose a date",
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selectedDate = parseDate(value);
  const minDate = parseDate(min);
  const maxDate = parseDate(max);
  const today = new Date();
  const todayValue = toDateValue(today);
  const todayIsDisabled = Boolean((min && todayValue < min) || (max && todayValue > max));
  const hasDateBounds = Boolean(minDate || maxDate);

  const selectDate = (date?: Date) => {
    if (!date) return;
    onChange(toDateValue(date));
    setOpen(false);
  };

  const clearDate = () => {
    onChange("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-haspopup="dialog"
          className={cn(
            "h-10 w-full justify-between rounded-md border-input bg-background px-3 py-2 text-left font-normal text-foreground shadow-none hover:bg-background hover:text-foreground",
            className,
          )}
        >
          <span className={cn("truncate", !selectedDate && "text-muted-foreground")}>
            {selectedDate ? format(selectedDate, "MMM d, yyyy") : placeholder}
          </span>
          <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto max-w-[calc(100vw-2rem)] p-0">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={selectDate}
          disabled={hasDateBounds ? date => Boolean((minDate && date < minDate) || (maxDate && date > maxDate)) : undefined}
          initialFocus
        />
        <div className="flex items-center justify-between border-t border-border px-3 py-2">
          {required ? <span /> : (
            <Button type="button" variant="ghost" size="sm" onClick={clearDate} disabled={!value}>
              Clear
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={() => selectDate(today)} disabled={todayIsDisabled}>
            Today
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
