# Contributing

Thanks for helping! Read [CLAUDE.md](CLAUDE.md) for architecture and conventions.

## Setup

```bash
nvm use        # or: fnm use  (Node 24, see .nvmrc)
npm ci
cp .env.example .env
npm run infra:up
npm run db:migrate
npm run db:seed
npm run start:dev
```

## Branches (Git Flow)

| Branch                   | From      | PR into   | Merge style  |
| ------------------------ | --------- | --------- | ------------ |
| `feature/<scope>-<desc>` | `develop` | `develop` | squash       |
| `release/X.Y.Z`          | `develop` | `main`    | merge commit |
| `hotfix/<desc>`          | `main`    | `main`    | merge commit |

`main` = production (every merge tagged `vX.Y.Z`). `develop` = staging and the default branch.
Nobody pushes directly to `main` or `develop`.

### Feature

```bash
git switch develop && git pull
git switch -c feature/pomodoro-sessions
# ... commits ...
git push -u origin feature/pomodoro-sessions
gh pr create --base develop --fill
# after review + green CI: squash merge
```

### Release

```bash
git switch develop && git pull
git switch -c release/1.2.0
npm run release -- --release-as 1.2.0   # bumps package.json + src/version.ts, writes CHANGELOG, tags locally
git push -u origin release/1.2.0
gh pr create --base main --title "chore(release): v1.2.0" --fill
# after merge (merge commit):
git switch main && git pull
git tag -a v1.2.0 -m "v1.2.0" && git push origin v1.2.0   # if the tag was not pushed with the branch
git switch develop && git pull && git merge --no-ff main && git push   # via PR if protected
```

### Hotfix

```bash
git switch main && git pull
git switch -c hotfix/fix-refresh-reuse
# ... fix + test ...
npm run release -- --release-as patch
git push -u origin hotfix/fix-refresh-reuse
gh pr create --base main --fill
# after merge: tag vX.Y.Z on main, then merge main back into develop (PR)
```

## Commits

Conventional Commits, checked by commitlint on `commit-msg`:

```
feat(pomodoro): add session start and complete endpoints
fix(auth): rotate refresh token on reuse detection
test(goals): add e2e tests for supervisor-assigned goals
```

Types: feat, fix, perf, refactor, test, docs, style, build, ci, chore, revert.
Scopes: auth, users, roles, tools, goals, pomodoro, challenges, invitations, notifications,
storage, mail, admin, db, config, deps, postman, release.

## Hooks

- `pre-commit`: lint-staged (prettier + eslint --fix) and gitleaks on staged files.
- `commit-msg`: commitlint.
- `pre-push`: `npm run typecheck && npm run test && npm run postman:check`.

## Before opening a PR

```bash
npm run format:check && npm run lint && npm run typecheck
npm run test:cov && npm run test:e2e
npm run postman:check && npm run db:check-rls && npm run build
```

Fill the Definition of Done checklist in the PR template. Security issues: see SECURITY.md.
