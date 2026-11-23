# Security Policy

Muthaker is used mostly by **minors**. We take security and privacy reports seriously.

## Reporting a vulnerability

- **Do not open a public issue, discussion or pull request** for a vulnerability.
- Report it privately through GitHub:
  **Security → Advisories → Report a vulnerability**
  (<https://github.com/saeednaltout/muthaker-api/security/advisories/new>).
- Include: affected endpoint or component, steps to reproduce, impact, and any proof of concept.
- Never include real user data. Use test accounts only.

We aim to acknowledge reports within **3 days** and to share a fix plan within **14 days**.
Please give us reasonable time to fix the issue before any public disclosure.

## Supported versions

Only the latest release on `main` (production) receives security fixes.

## Scope

In scope: this repository (the API) and the companion web app (`muthaker-web`).
Out of scope: third-party services (Vercel, Supabase, Upstash, Google), denial-of-service and
social-engineering attacks.
