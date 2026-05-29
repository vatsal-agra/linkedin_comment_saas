// Date/time helpers. Backend stores naive UTC timestamps (no offset),
// while scheduler timestamps come with an offset. Normalize both to UTC.

export function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const hasTz = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(s);
  const d = new Date(hasTz ? s : `${s}Z`);
  return isNaN(d.getTime()) ? null : d;
}

export function fmtDateTime(s: string | null | undefined): string {
  const d = parseDate(s);
  if (!d) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function fmtRelative(s: string | null | undefined): string {
  const d = parseDate(s);
  if (!d) return "never";
  const diff = Date.now() - d.getTime();
  const sec = Math.round(diff / 1000);
  const min = Math.round(sec / 60);
  const hr = Math.round(min / 60);
  const day = Math.round(hr / 24);
  if (sec < 60) return "just now";
  if (min < 60) return `${min}m ago`;
  if (hr < 24) return `${hr}h ago`;
  if (day < 30) return `${day}d ago`;
  return fmtDateTime(s);
}

// Format an hour/minute pair (0-23, 0-59) as a readable clock time.
export function fmtClock(hour: number, minute: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const ampm = hour < 12 ? "AM" : "PM";
  return `${h12}:${String(minute).padStart(2, "0")} ${ampm}`;
}
