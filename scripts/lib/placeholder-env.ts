/**
 * Side-effect module: MUST be imported before anything from src/.
 * Forces placeholder env (ignoring any local .env) so OpenAPI generation works anywhere
 * (CI, fresh clone) and its output never depends on the machine.
 */
const PLACEHOLDER_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/placeholder',
  DIRECT_URL: 'postgresql://user:pass@localhost:5432/placeholder',
  WEB_ORIGIN: 'http://localhost:3000',
  WEB_APP_URL: 'http://localhost:3000',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
  JWT_REFRESH_SECRET: 'y'.repeat(32),
  GOOGLE_CLIENT_ID: 'placeholder',
  GOOGLE_CLIENT_SECRET: 'placeholder',
  GOOGLE_REDIRECT_URI: 'http://localhost:3000/api/v1/auth/google/callback',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_REGION: 'us-east-1',
  S3_ACCESS_KEY_ID: 'placeholder',
  S3_SECRET_ACCESS_KEY: 'placeholder',
  SMTP_HOST: 'localhost',
  SMTP_PORT: '1025',
  MAIL_FROM: 'Muthaker <no-reply@example.com>',
  CRON_SECRET: 'z'.repeat(32),
  REDIS_URL: '',
  LOG_LEVEL: 'silent',
};

Object.assign(process.env, PLACEHOLDER_ENV);
