export function hashHue(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

export function initialsFor(input: string): string {
  if (!input) return '??';
  const parts = input.split(/[\s._@-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return input.slice(0, 2).toUpperCase();
}

export function shortId(id: string, len = 8): string {
  return id ? id.slice(0, len) : '';
}

/**
 * Returns the "other" user id encoded in a dm channel name like `dm:<a>:<b>`.
 * Returns null if not a dm-style name or the current user is not in the pair.
 */
export function otherUserIdFromDmName(name: string, currentUserId: string): string | null {
  if (!name?.startsWith('dm:')) return null;
  const parts = name.slice(3).split(':');
  if (parts.length !== 2) return null;
  const [a, b] = parts;
  if (a === currentUserId) return b;
  if (b === currentUserId) return a;
  return parts[0]; // best-effort fallback
}

export function isSameDay(a: string, b: string): boolean {
  return a.slice(0, 10) === b.slice(0, 10);
}

export function shouldGroupWith(
  prev: { authorId: string; createdAt: string } | null,
  cur: { authorId: string; createdAt: string },
  windowMs = 5 * 60 * 1000,
): boolean {
  if (!prev) return false;
  if (prev.authorId !== cur.authorId) return false;
  const dt = new Date(cur.createdAt).getTime() - new Date(prev.createdAt).getTime();
  return dt >= 0 && dt < windowMs;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatRelative(iso: string, now = Date.now()): string {
  const d = new Date(iso);
  const diff = now - d.getTime();
  if (Number.isNaN(diff)) return '';
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return d.toLocaleDateString();
}
