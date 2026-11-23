import { TEST_ENV } from '../../test/test-env';
import { validateEnv } from './env.schema';

describe('validateEnv', () => {
  it('parses a valid env and applies coercions/defaults', () => {
    const env = validateEnv({ ...TEST_ENV, PORT: undefined, S3_FORCE_PATH_STYLE: 'true' });
    expect(env.PORT).toBe(4000);
    expect(env.SMTP_PORT).toBe(1025);
    expect(env.S3_FORCE_PATH_STYLE).toBe(true);
    expect(env.COOKIE_SECURE).toBe(false);
    expect(env.ACCESS_TOKEN_TTL).toBe('15m');
    expect(env.REDIS_URL).toBeUndefined();
  });

  it('splits WEB_ORIGIN into an allowlist', () => {
    const env = validateEnv({ ...TEST_ENV, WEB_ORIGIN: 'http://a.test, https://b.test' });
    expect(env.WEB_ORIGIN).toEqual(['http://a.test', 'https://b.test']);
  });

  it('fails fast with a readable message listing every invalid variable', () => {
    expect(() =>
      validateEnv({ ...TEST_ENV, DATABASE_URL: 'nope', CRON_SECRET: 'short', NODE_ENV: 'prod' }),
    ).toThrow(/DATABASE_URL[\s\S]*CRON_SECRET|CRON_SECRET[\s\S]*DATABASE_URL/);
  });

  it('rejects invalid durations', () => {
    expect(() => validateEnv({ ...TEST_ENV, ACCESS_TOKEN_TTL: '15 minutes' })).toThrow(
      /ACCESS_TOKEN_TTL/,
    );
  });
});
