/**
 * Environment for e2e tests. Values already set in process.env win (CI overrides them).
 * Fake data only — never real student data.
 */
export const TEST_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  DATABASE_URL: 'postgresql://muthaker:muthaker@localhost:5433/muthaker_test',
  DIRECT_URL: 'postgresql://muthaker:muthaker@localhost:5433/muthaker_test',
  WEB_ORIGIN: 'http://localhost:3000',
  WEB_APP_URL: 'http://localhost:3000',
  JWT_ACCESS_SECRET: 'test-access-secret-test-access-secret-0000',
  JWT_REFRESH_SECRET: 'test-refresh-secret-test-refresh-secret-000',
  COOKIE_SECURE: 'false',
  GOOGLE_CLIENT_ID: 'test-client-id.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'test-google-secret',
  GOOGLE_REDIRECT_URI: 'http://localhost:3000/api/v1/auth/google/callback',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_REGION: 'us-east-1',
  S3_ACCESS_KEY_ID: 'minioadmin',
  S3_SECRET_ACCESS_KEY: 'minioadmin',
  S3_FORCE_PATH_STYLE: 'true',
  S3_BUCKET_PUBLIC: 'avatars',
  S3_BUCKET_PRIVATE: 'attachments',
  SMTP_HOST: 'localhost',
  SMTP_PORT: '1025',
  SMTP_SECURE: 'false',
  MAIL_FROM: 'Muthaker Test <test@muthaker.local>',
  REDIS_URL: '',
  CRON_SECRET: 'test-cron-secret-test-cron-secret-000000',
};

export const MAILPIT_API = process.env.MAILPIT_API ?? 'http://localhost:8025/api/v1';

export function applyTestEnv(): void {
  for (const [key, value] of Object.entries(TEST_ENV)) {
    process.env[key] ??= value;
  }
}
