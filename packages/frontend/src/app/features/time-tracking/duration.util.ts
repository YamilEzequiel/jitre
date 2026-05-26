/**
 * Flexible duration parser. Accepts:
 *  - "1h 30m" / "1h30m"   -> 90
 *  - "1.5h" / "1.5 h"      -> 90
 *  - "90m" / "90 m"        -> 90
 *  - "90"                  -> 90
 *  - "2h"                  -> 120
 *  - ".5h"                 -> 30
 *
 * Returns null when the input is empty or unparseable.
 */
export function parseDurationToMinutes(input: string | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  const raw = String(input).trim().toLowerCase();
  if (!raw) return null;

  // bare number => minutes
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(n);
  }

  // try matching `XhYm` / `Xh Ym` / `Xh` / `Ym` (X may be decimal)
  const re = /^(?:(\d+(?:\.\d+)?|\.\d+)\s*h)?\s*(?:(\d+(?:\.\d+)?|\.\d+)\s*m)?$/;
  const match = raw.match(re);
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

/** Format seconds as H:MM:SS for a running timer (e.g. 3725 -> "1:02:05"). */
export function formatTimerSeconds(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${h}:${pad(m)}:${pad(s)}`;
}
