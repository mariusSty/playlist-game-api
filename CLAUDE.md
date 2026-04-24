# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `pnpm start:dev` — run the server in watch mode on port 3000 (CORS enabled).
- `pnpm build` — Nest build to `dist/`.
- `pnpm lint` — ESLint with `--fix`.
- `pnpm test` — Jest unit tests (`*.spec.ts` colocated under `src/`, `rootDir: src`).
- Run a single unit test: `pnpm test -- path/to/file.spec.ts` or `pnpm test -- -t "test name"`.
- `pnpm test:e2e` — boots `docker-compose.test.yml` (Postgres 16 on port **5434**) then runs e2e specs from `test/`. E2E tests load `.env.test` and call `pushSchema()` (`prisma db push` against `TEST_DATABASE_URL`) in `beforeAll` — no migrations are applied in tests.
- Run a single e2e test: `docker compose -f docker-compose.test.yml up -d && jest --config ./test/jest-e2e.json --runInBand test/room.e2e-spec.ts`.
- `npx prisma migrate dev` — apply migrations locally. The Prisma CLI reads `prisma.config.ts`, which uses `DIRECT_DATABASE_URL` (direct Postgres) for migrations while the app runtime connects via `DATABASE_URL` (Prisma Accelerate, `prisma+postgres://…`). Both vars must be set.
- `pnpm dlx tsx prisma/seed.ts` — seed (also wired via `prisma.seed` in `package.json`).
- `postinstall` runs `prisma generate`; the client is emitted to `src/generated/prisma/` (checked into the repo output path, gitignored or not — confirm before committing). Import from `src/generated/prisma/client`, not `@prisma/client`.

## Architecture

NestJS 11 monolith exposing a REST API + a single Socket.IO gateway, backed by Postgres via Prisma 7 with the Accelerate extension.

**Module layout** (`src/app.module.ts`): `PrismaModule` (global) → `HealthModule`, `SessionModule` (global), `RoomModule`, `GameModule`, `RoundModule`, `PickModule` (owns `vote/` submodule), `ThemeModule`, `UserModule`. `RoomModule ↔ GameModule` uses `forwardRef` because leaving a room must clean up in-flight game state.

**Prisma access pattern.** `PrismaService` (`src/prisma.service.ts`) exposes `client` — an Accelerate-extended `PrismaClient`. Always go through `prisma.client.<model>`, never instantiate `PrismaClient` directly. E2e tests override `PrismaService` with a `PrismaPg` adapter pointed at the test DB (see `test/room.e2e-spec.ts`).

**Realtime is a single gateway, not per-domain.** `src/session/session.gateway.ts` is the only `@WebSocketGateway`. Controllers mutate state via REST, then call `sessionGateway.emitSessionUpdated(pin)` which broadcasts a generic `session:updated` event to the Socket.IO room keyed by `pin`. Clients subscribe with `session:subscribe { pin, userId }` (membership is verified against the room) and unsubscribe with `session:unsubscribe`. Clients are expected to refetch authoritative state on `session:updated` — the payload is intentionally empty. **The README's WebSocket section is outdated** (it documents old per-domain events like `room:updated`, `game:started`, `pick:updated`, etc.); trust the code.

**Game flow state machine.** A `Game` has one `Round` per player (each player is `themeMaster` once). A round progresses: themeMaster sets `themeId` **or** `customTheme` (XOR, enforced in `RoundController.pickTheme`) → players create `Pick`s (unique per `(roundId, userId)`) → players cast `Vote`s (unique per `(pickId, guessUserId)`) → `POST /round/next` sets `revealCompleted = true`. `RoundService.markRevealCompleted` finds "the current round" as the first themed, not-yet-completed round in the game. Scoring in `GameService.calculateResults`: 1 point per vote where `guessedUserId === pick.userId`.

**Leave-during-game cleanup** (`GameService.removeUser`) runs in a transaction and is order-sensitive: delete unthemed rounds where the leaver is themeMaster → delete votes on/by them in active (themed, not revealed) rounds → delete their picks in active rounds → disconnect from `game.users`. Don't short-circuit this when touching room/game leave logic.

**Deezer proxy.** `MusicApiService` (`src/pick/musicapi.service.ts`) hits `api.deezer.com/search` with no key or caching. Results are normalized to `{ id, title, artist, album, cover, previewUrl }` — when adding fields, update both the mapper and any consuming DTO.

**Sentry.** `src/instrument.ts` must be the first import in `main.ts` (side-effect import). `SentryGlobalFilter` is registered as `APP_FILTER`. Logs are emitted via `Sentry.logger.*` in the session gateway.

**TS config quirks.** `strictNullChecks`, `noImplicitAny`, and `strictBindCallApply` are **off**; `@typescript-eslint/no-explicit-any` is **off**. Path alias `src/*` resolves from the project root (see `tsconfig.json` `baseUrl: "./"`). E2e Jest config (`test/jest-e2e.json`) maps `^src/(.*)$` → `<rootDir>/../src/$1`.

**Deployment.** Fly.io (region `jnb`), `.github/workflows/fly-deploy.yml` runs `flyctl deploy` on push to `main`. `fly.toml` sets `release_command = 'npx prisma migrate deploy'` — schema migrations run on every deploy before the new machine starts. The Dockerfile CMD is `node dist/src/main.js` (note the `src/` segment — `nest build` preserves the source tree).
