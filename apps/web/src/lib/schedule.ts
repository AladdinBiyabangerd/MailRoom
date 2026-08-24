/** Convert datetime-local value to ISO-8601 UTC for the API. */
export function localDatetimeToIso(value: string): string | undefined {
  if (!value.trim()) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

/** Minimum selectable schedule time (~5 minutes from now) for datetime-local inputs. */
export function minScheduleDatetimeLocal(): string {
  const date = new Date(Date.now() + 5 * 60_000);
  date.setSeconds(0, 0);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function isScheduleInFuture(isoValue: string): boolean {
  const date = new Date(isoValue);
  return !Number.isNaN(date.getTime()) && date.getTime() > Date.now();
}

const LEGACY_UTC_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;

/** Parse API datetime (ISO-8601 or legacy UTC "yyyy-MM-dd HH:mm"). */
export function parseApiDateTime(value: string): Date {
  const trimmed = value.trim();
  if (LEGACY_UTC_PATTERN.test(trimmed)) {
    return new Date(`${trimmed.replace(" ", "T")}Z`);
  }
  return new Date(trimmed);
}

/** Format API datetime in the browser's local timezone. */
export function formatDateTimeLocal(
  value: string | null | undefined,
  locale?: string,
): string {
  if (!value) return "—";
  const date = parseApiDateTime(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Convert API datetime to a datetime-local input value (browser local timezone). */
export function apiDateTimeToLocalInput(value: string | null | undefined): string {
  if (!value) return "";
  const date = parseApiDateTime(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** IANA timezone label for UI hints, e.g. "Asia/Baku". */
export function getLocalTimezoneLabel(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
