---
description: Guided workflow to create, name, and apply a Prisma migration cleanly, then keep the Nest layer in sync. Use when the user edits `schema.prisma`, asks to "add a migration", "rename a column", "add a table", or after pulling changes that include new migrations.
argument-hint: [short-description]
disable-model-invocation: true
allowed-tools: Read, Edit, Bash(pnpm prisma *), Bash(pnpm exec prisma *), Bash(git status *), Bash(git diff *)
---

## Current state

```!
cd /Users/mariusstephanperso/Projects/playlist-game-workspace/playlist-game-api && git status --short prisma/ src/ 2>&1
```

```!
cd /Users/mariusstephanperso/Projects/playlist-game-workspace/playlist-game-api && pnpm exec prisma migrate status 2>&1 || true
```

## Workflow

You are running this from `playlist-game-api/`. The description for this migration is: **$ARGUMENTS**

1. **Confirm the schema diff**: read `prisma/schema.prisma` and summarize what changed since the last migration. If `$ARGUMENTS` is empty, ask the user for a kebab-case description before continuing.
2. **Name the migration** in kebab-case based on the diff (e.g. `add-vote-skipped-flag`, `rename-room-code-to-slug`). Confirm the name with the user.
3. **Generate** with: `pnpm exec prisma migrate dev --name <name>`. This applies it to the dev DB and regenerates the client.
4. **Audit the SQL** Prisma produced. Read the new file under `prisma/migrations/<timestamp>_<name>/migration.sql` and flag anything risky:
   - data loss (DROP COLUMN on a non-empty table, type change without USING)
   - missing index on a new FK
   - non-nullable column added to a table that already has rows, with no default
5. **Sync the Nest layer**:
   - Grep `src/` for the renamed/removed field; update DTOs, entities, services, controllers.
   - If a new field is in the canonical `Room | Game | Round | Pick | Vote | UserSession | Track` set, remind the user to mirror it in `playlist-game/types/room.ts` (point them at the `sync-types` skill).
6. **Verify**: run `pnpm exec tsc --noEmit` and report failures. Don't run tests unless asked.
7. **Stop**. Don't commit. Don't deploy. Don't run `migrate deploy` against prod.

Never use `prisma db push` here — it bypasses the migration history, which is what Fly's `migrate deploy` reads on boot.
