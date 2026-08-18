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

function parseDateValue(value: string): Date | null {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? parseISO(`${value}T12:00:00`)
    : parseISO(value);

  return isValid(parsed) ? parsed : null;
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
