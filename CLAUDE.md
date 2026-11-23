# CLAUDE.md — Muthaker API («مُذاكِر»)

NestJS REST API for Muthaker. Companion repo: `muthaker-web` (Next.js). Keep this file updated.

## 1. Product context

A bilingual (**Arabic default, RTL** + English) platform that helps baccalaureate students plan
and track their study using proven study tools (SMART goals, Pomodoro; later SWOT, Eisenhower,
Time Blocking, SQ3R, Feynman, Cornell, Mind maps, Leitner, PDCA, Error log).

Roles:

- `STUDENT`: uses the study tools, joins challenges.
- `SUPERVISOR`: creates goals and challenges for students and invites them by public student
  code. **Requires admin approval** (`status = PENDING_APPROVAL` until approved).
- `ADMIN`: seeded only (never selectable at signup). Manages users, supervisor approvals and
  moderation of public challenges.

Challenges:

- Supervisor attaches resources, students upload submissions (both upload files).
- `PRIVATE`: students join only by invitation via their `publicCode`, and must accept.
- `PUBLIC`: listed; students send a **join request** the supervisor approves/rejects.
- Peer (student ↔ student) and supervisor challenges share one `Challenge` model with a `type`.

Most users are **minors**: collect minimal data, no public profiles, no direct chat, students
must **accept** invitations.

Study tools are **pluggable**: a `Tool` catalog + `ToolEntry` records whose inputs/results are
JSONB validated by a per-tool Zod schema. New tools never restructure the database.

## 2. Architecture (decided — do not change without asking)

| Concern         | Decision                                                                                                        |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| Backend         | NestJS 11, REST, prefix `/api`, URI versioning → `/api/v1/...`                                                  |
| DB              | PostgreSQL 17. Local: Docker. Staging/prod: Supabase Postgres                                                   |
| ORM             | Prisma 7 (`prisma.config.ts`, `prisma-client` generator → `src/generated/prisma`, adapter-pg)                   |
| Files           | S3 API (MinIO local, Supabase Storage prod). Browser uploads via **presigned PUT** only                         |
| Email           | Nodemailer over SMTP, provider chosen only by `SMTP_*` (Mailpit / Gmail App Password / relay)                   |
| Auth            | Own implementation: email/password + Google OIDC, httpOnly cookies + refresh rotation; Bearer accepted (mobile) |
| Validation      | Zod 4 everywhere via `nestjs-zod` (no class-validator)                                                          |
| API contract    | OpenAPI from code → committed `openapi/openapi.json` → Postman collection + web client (orval)                  |
| Hosting         | Vercel (zero-config NestJS, Fluid compute), entry `src/main.ts`                                                 |
| Background work | No workers. `waitUntil` for fire-and-forget; `outbox` table + `/internal/cron/*` endpoints                      |
| Rate limiting   | `@nestjs/throttler` + Redis (`REDIS_URL`, Upstash in prod); in-memory if empty                                  |
| Logging         | `nestjs-pino`, JSON in prod, every line has `requestId` (also returned as `x-request-id`)                       |
| Cost            | Free tiers only (Vercel Hobby, Supabase Free ×2, Upstash Free, Gmail SMTP, cron-job.org). No Sentry             |

DB connections:

- `DATABASE_URL` (runtime): Supabase **transaction pooler, port 6543** in prod.
- `DIRECT_URL` (migrations only): direct or session pooler 5432. **Never migrate via 6543.**

Supabase security: **every table has RLS enabled (no policies)**. The API connects as owner and
bypasses RLS; this blocks Supabase's public Data API. Every migration that creates a table must
include `ALTER TABLE "<name>" ENABLE ROW LEVEL SECURITY;`. CI fails otherwise
(`npm run db:check-rls`).

### Pinned versions (why)

- **NestJS 11** (not 12): `nestjs-zod` supports only `@nestjs/common` ≤ 11 / swagger 11.
  `@nestjs/config` is pinned to **4.x** (5+/12.x is ESM-only for Nest 12).
- **TypeScript 6.0** (not 7): typescript-eslint, ts-jest and the Nest CLI do not support TS 7.
- **Prisma 7.10** (stable). `latest` dist-tag points to an 8.0 RC; do not use pre-releases.
- MinIO images: `minio/minio` is gone from Docker Hub → Chainguard `cgr.dev/chainguard/minio`.
- npm 11 `allowScripts` in package.json: only prisma, @prisma/engines and esbuild may run
  install scripts. Review new ones with `npm install-scripts ls`.

## 3. Commands

```bash
npm run infra:up          # Postgres 5432, Postgres-test 5433, MinIO 9000/9001, Redis 6379, Mailpit 1025/8025
npm run db:migrate        # prisma migrate dev (create/apply migrations locally)
npm run db:seed           # admin from SEED_ADMIN_* (idempotent)
npm run start:dev         # http://localhost:4000/api/v1, Swagger at /api/docs
npm run test              # unit (Prisma mocked)
npm run test:cov          # unit + coverage threshold
npm run test:e2e          # e2e against postgres-test + MinIO + Mailpit (needs infra:up)
npm run lint / typecheck / format:check
npm run postman:generate  # regenerate openapi/openapi.json + postman/*  (commit both)
npm run postman:check     # fails if they are outdated
npm run db:check-rls      # fails if any public table has RLS disabled
npm run release           # on release/X.Y.Z: bump version + CHANGELOG
```

`prisma migrate reset` refuses to run from an AI agent without explicit user consent. Ask first.

## 4. Folder structure

```
src/
  main.ts            bootstrap (local server + Vercel)
  app.setup.ts       configureApp() + OpenAPI builder — the ONLY place the app is configured
  app.module.ts      global pipe/interceptor/filter/guards, logger, throttler
  config/            zod env schema (fail fast)
  common/            decorators (@Public, @Roles, @CurrentUser), guards, filters, errors, utils
  prisma/            PrismaModule (global, lazy connect)
  storage/           StorageService (presigned PUT/GET, delete, publicUrl) + upload policies
  mail/              MailService, renderer, templates/{layout,ar/*,en/*}.hbs
  outbox/            durable job queue (retry with backoff)
  cron/              /internal/cron/{outbox,cleanup} (Bearer CRON_SECRET)
  health/            GET /api/v1/health
  modules/<feature>/ controller, service, dto/ (zod), *.spec.ts
  generated/prisma/  generated client (git-ignored)
prisma/              schema.prisma, migrations/, seed.ts
test/                e2e specs, helpers (app, db, factories, mailpit), unit helpers
scripts/             generate-openapi, generate-postman, check-postman, check-rls
openapi/ postman/    committed, generated
```

## 5. Conventions

- **Errors** always: `{ statusCode, code, message, details?, requestId }`. Throw `AppException`
  with a code from `src/common/errors/error-codes.ts` (web translates `errors.<CODE>`).
  Never rename a shipped code.
- **DTOs**: Zod schemas + `createZodDto`, `.meta({ id, example })` for OpenAPI; responses via
  `@ZodResponse({ type })` so runtime, types and docs stay in sync. Give every free-form object
  (`z.record`) a schema-level example (keeps Postman generation deterministic).
- **Auth**: routes are private by default once the Auth feature adds the global auth guard;
  use `@Public()` explicitly. Role checks with `@Roles(...)`; ownership checks in services.
- No `any` (use `unknown`), no `console.log` (use Nest `Logger` / pino), strict TS with
  `noUncheckedIndexedAccess`. Prettier formats; ESLint (flat) lints; imports sorted.
- DB: `snake_case` via `@@map/@map`, uuid ids, index every FK, migrations backward compatible
  (expand → deploy → contract), RLS on every new table.
- Uploads: never through the API. Issue presigned URLs with `StorageService.createUploadUrl`
  (type + exact size are signed). Avatars ≤ 1 MB (WebP, resized client-side), attachments
  ≤ 10 MB (pdf, images, docx). Per-user quota `USER_STORAGE_QUOTA_BYTES` is enforced by the
  first feature that persists file records; it must also delete orphaned files.
- Emails: `mail.sendInBackground(...)` from request handlers (never await SMTP in a request).
- Tests and seed data: fake data only, never real student data.

### Commits (Conventional Commits, enforced)

`type(scope): subject` — types: feat, fix, perf, refactor, test, docs, style, build, ci, chore,
revert. Scopes: auth, users, roles, tools, goals, pomodoro, challenges, invitations,
notifications, storage, mail, admin, db, config, deps, postman, release. Subject: English,
imperative, lowercase, no period, header ≤ 72. Body explains why (wrap 100). Footer
`BREAKING CHANGE:` / `Refs #N`. Tests in the same commit or a `test:` commit right after.

### Git Flow

`main` (prod, tagged) ← `release/X.Y.Z` / `hotfix/*`; `develop` (staging, default branch) ←
`feature/<scope>-<desc>` (squash). See CONTRIBUTING.md for exact commands.

## 6. Feature workflow + Definition of Done

1. `git switch develop && git pull && git switch -c feature/<scope>-<desc>`
2. Write a short plan in the PR description (endpoints, schema changes, screens) and confirm it.
3. API: Prisma migration (RLS for new tables, backward compatible) → Zod DTOs with OpenAPI
   metadata and examples → service → controller with `@Roles`/ownership checks → unit + e2e.
4. `npm run postman:generate` and commit `openapi/` + `postman/` in the same PR.
5. Web: `npm run api:generate` → components (shadcn only) → i18n keys in ar and en → error codes
   in `errors.*` → tests.
6. Run every check locally, push, open a PR into `develop` using the template.

**Definition of Done**

- [ ] Zod validation on every input; consistent error `code`s added to `error-codes.ts`
- [ ] Authorization tested (wrong role → 403, not owner → 403/404)
- [ ] Unit tests + e2e tests for every new endpoint; coverage threshold met
- [ ] Migration is backward compatible and enables RLS on new tables
- [ ] `openapi.json` and the Postman collection regenerated; `npm run postman:check` passes
- [ ] Web client regenerated; `npm run api:check` passes
- [ ] All UI text in `ar.json` and `en.json`; checked in RTL + LTR and in light + dark
- [ ] Component/hook tests written
- [ ] No secrets, no `any`, no `console.log`
- [ ] Commits follow the convention

### Testing policy

- Unit tests for every service: happy path, validation errors, not-found, **authorization**
  (wrong role, not owner). Prisma mocked with `jest-mock-extended`.
- E2E (supertest) for every endpoint against real Postgres (`postgres-test`, 5433): 2xx, 400
  (zod), 401 (no cookie), 403 (wrong role), 404. Use `test/helpers/factories.ts` to create users
  per role (`loginAs` helper is added with Auth & Roles).
- Coverage threshold (global): 80% lines and functions. Raise over time, never lower.

## 7. Next feature: Auth & Roles — Google sign-in requirements

- Authorization Code flow with **PKCE + `state` + `nonce`** implemented in NestJS
  (`openid-client` or `google-auth-library`; no session-based passport). Verifier, state and
  nonce live in a short-lived (10 min) httpOnly cookie.
- `GET /api/v1/auth/google?next=/path` → redirect to Google (scopes `openid email profile` only).
- `GET /api/v1/auth/google/callback` → validate state and nonce, verify the ID token, then:
  - existing `Account`: log in;
  - user with the same email and Google `email_verified = true`: link a new `Account`;
  - otherwise: create the user with `emailVerifiedAt = now`.
    Set auth cookies and redirect to `WEB_APP_URL` + `next`, or `/onboarding` if no role chosen
    (STUDENT, or SUPERVISOR → `PENDING_APPROVAL`). `next` must be a relative path (open-redirect
    protection).
- `GOOGLE_REDIRECT_URI` is on the **web origin** (proxied by the Next.js rewrite) so cookies stay
  first-party. The API never sets a cookie `Domain`.
- `POST /api/v1/auth/google/token` `{ idToken }` for the mobile app (verify audience against the
  allowed client IDs, return Bearer tokens).
- Users can set a password later, and can unlink Google only if a password exists.
- Suspended users are blocked on every login path. E2E tests mock Google's token endpoint and JWKS.
- Refresh tokens: hashed, rotated on every refresh, `familyId` reuse detection revokes the family.
