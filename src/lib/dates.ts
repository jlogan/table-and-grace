import { format, isValid, parseISO } from "date-fns";

/** Serialize MySQL date / Date values to `YYYY-MM-DD` for API payloads. */
export function toIsoDateString(value: Date | string | null | undefined): string | null {
  if (value == null) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parsed = parseISO(trimmed.includes("T") ? trimmed : `${trimmed}T12:00:00`);
  if (!isValid(parsed)) return null;

  return parsed.toISOString().slice(0, 10);
}

/** Serialize MySQL datetime / Date values to ISO 8601 for API payloads. */
export function toIsoDateTimeString(value: Date | string | null | undefined): string | null {
  if (value == null) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  const parsed = parseISO(normalized);
  if (!isValid(parsed)) return null;

  return parsed.toISOString();
}

function parseDateValue(value: string): Date | null {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? parseISO(`${value}T12:00:00`)
    : parseISO(value);

  return isValid(parsed) ? parsed : null;
}

/** Monday 12:00 local for the week containing `base` (batch week anchor). */
export function weekStartMonday(base = new Date()): Date {
  const d = new Date(base);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(12, 0, 0, 0);
  return d;
}

export function addDaysToDate(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** ISO Monday dates for upcoming batch weeks, starting with the current week. */
export function getUpcomingWeekStarts(count = 12): string[] {
  const start = weekStartMonday();
  return Array.from({ length: count }, (_, index) => {
    const week = addDaysToDate(start, index * 7);
    return toIsoDateString(week) ?? week.toISOString().slice(0, 10);
  });
}

/** Format ISO date or datetime strings without throwing on invalid input. */
export function formatDateString(
  value: string | null | undefined,
  pattern: string,
  fallback = "—",
): string {
  if (!value) return fallback;

  const parsed = parseDateValue(value);
  if (!parsed) return fallback;

  try {
    return format(parsed, pattern);
  } catch {
    return fallback;
  }
}
