import { hashPassword, verifyPassword } from './password';
import { generatePublicCode, PUBLIC_CODE_RE } from './public-code';
import { safeEqual } from './safe-equal';

describe('generatePublicCode', () => {
  it('produces XXX-XXXX codes without ambiguous characters', () => {
    for (let i = 0; i < 200; i++) {
      const code = generatePublicCode();
      expect(code).toMatch(PUBLIC_CODE_RE);
      expect(code).not.toMatch(/[01OILU]/);
    }
  });

  it('is practically unique', () => {
    const codes = new Set(Array.from({ length: 2000 }, generatePublicCode));
    expect(codes.size).toBe(2000);
  });
});

describe('safeEqual', () => {
  it('compares strings of any length', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual('', '')).toBe(true);
  });
});

describe('password hashing', () => {
  it('hashes with argon2id and verifies', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(hash).toMatch(/^\$argon2id\$/);
    await expect(verifyPassword(hash, 'correct horse battery')).resolves.toBe(true);
    await expect(verifyPassword(hash, 'wrong')).resolves.toBe(false);
  });
});
