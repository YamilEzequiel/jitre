const SENSITIVE_KEY_REGEX = /password|token|secret|api[_-]?key|authorization/i;

export function scrubSensitive(data: unknown, seen = new WeakSet()): unknown {
  if (data === null || typeof data !== 'object') {
    return data;
  }

  if (seen.has(data)) {
    return '[CIRCULAR]';
  }
  seen.add(data);

  if (Array.isArray(data)) {
    return (data as unknown[]).map((item) => scrubSensitive(item, seen));
  }

  if (data instanceof Date) {
    return data;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (SENSITIVE_KEY_REGEX.test(key)) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = scrubSensitive(value, seen);
    }
  }
  return result;
}
