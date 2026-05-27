/**
 * Flexible duration parser. Accepts everything natural a user might type:
 *  - "1h 30m" / "1h30m"          -> 90
 *  - "1h 30min" / "1 hr 30 mins" -> 90
 *  - "1.5h" / "1,5h"             -> 90
 *  - "90m" / "90min" / "90 min"  -> 90
 *  - "90"                        -> 90  (bare number = minutes)
 *  - "2h" / "2 hours" / "2hr"    -> 120
 *  - ".5h"                       -> 30
 *  - "1:30"                      -> 90  (colon-separated)
 *
 * Returns null when the input is empty or unparseable.
 */
export function parseDurationToMinutes(input: string | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  // Normalise: lowercase, replace comma decimal with dot, collapse whitespace.
  const raw = String(input).trim().toLowerCase().replace(/,/g, '.').replace(/\s+/g, ' ');
  if (!raw) return null;

  // bare number => minutes
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(n);
  }

  // colon format "1:30" => 1h 30m
  const colonMatch = /^(\d+):([0-5]?\d)$/.exec(raw);
  if (colonMatch) {
    const h = Number(colonMatch[1]);
    const m = Number(colonMatch[2]);
    const total = h * 60 + m;
    return total > 0 ? total : null;
  }

  // Strip long-form unit names down to single letters before regex.
  const normalised = raw
    .replace(/\b(hours|hour|hrs|hr)\b/g, 'h')
    .replace(/\b(minutes|minute|mins|min)\b/g, 'm')
    .replace(/\s+/g, ' ')
    .trim();

  // Match `XhYm` / `Xh Ym` / `Xh` / `Ym` (X may be decimal)
  const re = /^(?:(\d+(?:\.\d+)?|\.\d+)\s*h)?\s*(?:(\d+(?:\.\d+)?|\.\d+)\s*m)?$/;
  const match = normalised.match(re);
  if (!match) return null;

  const [, hoursStr, minutesStr] = match;
  if (!hoursStr && !minutesStr) return null;

  const hours = hoursStr ? Number(hoursStr) : 0;
  const minutes = minutesStr ? Number(minutesStr) : 0;
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || minutes < 0) return null;

  const total = Math.round(hours * 60 + minutes);
  return total > 0 ? total : null;
}

/** Format minutes as a compact "Xh Ym" string. 0 -> "0m". */
export function formatMinutes(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return '0m';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

/**
 * Format a stored date/datetime value as a short, readable label
 * (e.g. "27 May 2026"). Accepts ISO date or ISO datetime strings; returns
 * the input unchanged if it cannot be parsed so the UI never shows "Invalid Date".
 */
export function formatEntryDate(value: string | null | undefined): string {
  if (!value) return '—';
  // Fast path for plain YYYY-MM-DD (no timezone shenanigans needed).
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (ymd) {
    const [, y, m, d] = ymd;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    }
  }
  const fallback = new Date(value);
  if (!Number.isNaN(fallback.getTime())) {
    return fallback.toLocaleDateString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
  return value;
}

/** Format seconds as H:MM:SS for a running timer (e.g. 3725 -> "1:02:05"). */
export function formatTimerSeconds(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${h}:${pad(m)}:${pad(s)}`;
}
