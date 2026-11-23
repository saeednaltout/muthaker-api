## Summary

<!-- What does this PR change and why? Link the issue: Refs #123 -->

## Plan

<!-- Endpoints, schema changes, screens. Confirmed with the maintainer before implementation. -->

## Definition of Done

- [ ] Zod validation on every input; consistent error `code`s added to `error-codes.ts`
- [ ] Authorization tested (wrong role → 403, not owner → 403/404)
- [ ] Unit tests + e2e tests for every new endpoint; coverage threshold met
- [ ] Migration is backward compatible and enables RLS on new tables
- [ ] `openapi.json` and the Postman collection regenerated; `npm run postman:check` passes
- [ ] Web client regenerated; `npm run api:check` passes (web PR linked if needed)
- [ ] All UI text in `ar.json` and `en.json`; checked in RTL + LTR and in light + dark (web)
- [ ] Component/hook tests written (web)
- [ ] No secrets, no `any`, no `console.log`
- [ ] Commits follow the convention

## How to test

<!-- Commands, requests, screenshots. -->
