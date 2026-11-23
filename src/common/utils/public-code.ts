import { randomInt } from 'node:crypto';

/** No 0/O, 1/I/L, U: readable when dictated or typed by students. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Short human-friendly code used to invite students, e.g. `K7P-2QX9`.
 * 30^7 ≈ 2.2e10 combinations; uniqueness is still enforced by the DB unique index.
 */
export function generatePublicCode(): string {
  const pick = (n: number) =>
    Array.from({ length: n }, () => ALPHABET.charAt(randomInt(ALPHABET.length))).join('');
  return `${pick(3)}-${pick(4)}`;
}

export const PUBLIC_CODE_RE =
  /^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{3}-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{4}$/;
