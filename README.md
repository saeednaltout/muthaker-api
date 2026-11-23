# Muthaker API · «مُذاكِر»

REST API of **Muthaker**, a bilingual (Arabic/English) platform that helps baccalaureate students
plan and track their study with proven study tools (SMART goals, Pomodoro, and more).

Built with NestJS 11, Prisma 7 (PostgreSQL), Zod 4 and deployed on Vercel.

## Quick start

Requirements: Node 24 (`.nvmrc`), npm 11, Docker.

```bash
npm ci
cp .env.example .env
npm run infra:up      # Postgres, MinIO, Redis, Mailpit
npm run db:migrate
npm run db:seed
npm run start:dev
curl http://localhost:4000/api/v1/health
```

| Service          | URL                                             |
| ---------------- | ----------------------------------------------- |
| API              | http://localhost:4000/api/v1                    |
| Swagger UI       | http://localhost:4000/api/docs                  |
| OpenAPI JSON     | http://localhost:4000/api/docs-json             |
| Mailpit (emails) | http://localhost:8025                           |
| MinIO console    | http://localhost:9001 (minioadmin / minioadmin) |

## API contract

- `openapi/openapi.json` is generated from the code and committed.
- `postman/` holds a generated Postman collection plus local/staging environments.
- Regenerate with `npm run postman:generate`; CI fails if they are outdated.

## Docs

- [CLAUDE.md](CLAUDE.md): architecture, conventions, workflow, Definition of Done
- [CONTRIBUTING.md](CONTRIBUTING.md): Git Flow, commits, hooks
- [SECURITY.md](SECURITY.md): how to report vulnerabilities

## License

[MIT](LICENSE)
