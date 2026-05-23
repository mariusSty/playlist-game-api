---
description: Pre-flight checklist before `fly deploy` on the API. Verifies migrations, build, types, env vars, and git state. Use ONLY when the user explicitly asks to deploy or to run the pre-deploy check. Never auto-trigger.
disable-model-invocation: true
allowed-tools: Read, Bash(pnpm *), Bash(pnpm exec *), Bash(git status *), Bash(git log *), Bash(git diff *), Bash(fly *), Bash(flyctl *)
---

## Snapshot

```!
cd /Users/mariusstephanperso/Projects/playlist-game-workspace/playlist-game-api && git status --short 2>&1
```

```!
cd /Users/mariusstephanperso/Projects/playlist-game-workspace/playlist-game-api && git log --oneline origin/main..HEAD 2>&1 | head -20
```

```!
cd /Users/mariusstephanperso/Projects/playlist-game-workspace/playlist-game-api && pnpm exec prisma migrate status 2>&1 || true
```

```!
cd /Users/mariusstephanperso/Projects/playlist-game-workspace/playlist-game-api && cat fly.toml | head -40
```

## Checklist

Walk through each item and report PASS / FAIL / SKIP with one line of evidence. Do not run `fly deploy` yourself — at the end, print the exact command the user should run if everything is green.

1. **Git clean**: working tree clean, no untracked source files. (`git status --short` above)
2. **Branch ahead**: `HEAD` ahead of `origin/main`, or user is deploying main directly. List the commits going out.
3. **Migrations applied locally**: `prisma migrate status` reports "Database schema is up to date". If a migration is pending, the deploy will run it on boot via Fly's release command — surface this so the user knows.
4. **No `db push` artifacts**: grep recent commits for `db push` in commit messages or for un-migrated schema changes.
5. **Typecheck**: `pnpm exec tsc --noEmit`. Report first 5 errors if any.
6. **Build**: `pnpm build`. Report failure summary, not full output.
7. **Tests** (optional): ask the user before running, since they may be slow. Skip if they say no.
8. **Env vars**: list secrets referenced in `src/` (`process.env.X`) and cross-check against `fly secrets list` if the user has `flyctl` authed. Flag any name in code that isn't set on Fly.
9. **Health endpoint**: confirm `/health` route still exists in `src/health/`.

If everything passes, output:

```
Ready to deploy. Run:
  cd playlist-game-api && fly deploy
```

If anything fails, stop and list the blockers. Don't suggest `--force` flags.
