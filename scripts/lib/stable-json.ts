import { createHash } from 'node:crypto';

/** Recursively sorts object keys (arrays keep their order) for deterministic output. */
export function sortKeys<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v: unknown) => sortKeys(v)) as T;
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return out as T;
  }
  return value;
}

export function stableStringify(value: unknown): string {
  return `${JSON.stringify(sortKeys(value), null, 2)}\n`;
}

/** Deterministic UUID-shaped id from arbitrary text (used instead of random Postman ids). */
export function deterministicId(...parts: string[]): string {
  const h = createHash('sha256').update(parts.join('|')).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}
