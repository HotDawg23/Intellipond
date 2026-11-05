import { format, parseISO } from "date-fns";

const manilaDateTime = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export const formatReportDateTime = (value: string | null) =>
  value ? manilaDateTime.format(new Date(value)) : "—";

export const formatReportPeriod = (start: string | null, end: string | null) =>
  start && end
    ? `${format(parseISO(start), "MMM d, yyyy")} to ${format(parseISO(end), "MMM d, yyyy")}`
    : "Dates not available";
