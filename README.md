# 🎵 Playlist Game API

Backend temps réel pour **Playlist Game**, un jeu mobile multijoueur où chaque manche pose un thème, chaque joueur choisit une chanson anonymement, et les autres doivent deviner qui a choisi quoi.

---

## Stack technique

| Couche               | Technologie                                                              |
| -------------------- | ------------------------------------------------------------------------ |
| **Framework**        | [NestJS](https://nestjs.com/) 11                                         |
| **Langage**          | TypeScript 5.9                                                           |
| **Runtime**          | Node.js 24                                                               |
| **Base de données**  | PostgreSQL 16 via [Prisma](https://www.prisma.io/) 7 + Prisma Accelerate |
| **Temps réel**       | WebSockets — [Socket.IO](https://socket.io/) 4                           |
| **API musicale**     | [Deezer API](https://developers.deezer.com/) (extraits 30 s)             |
| **Package manager**  | pnpm 10                                                                  |
| **Conteneurisation** | Docker (multi-stage build)                                               |
| **Hébergement**      | [Fly.io](https://fly.io/) (région `jnb`)                                 |
| **Monitoring**       | [Sentry](https://sentry.io/) (errors + perf + profiling)                 |
| **Health checks**    | [@nestjs/terminus](https://docs.nestjs.com/recipes/terminus)             |
| **Tests**            | Jest 30 · Supertest · Socket.IO Client                                   |

---

## Prérequis

- **Node.js** >= 24
- **pnpm** >= 10
- **PostgreSQL** 16+ (ou un endpoint Prisma Accelerate)

---

## Installation

```bash
git clone <repo-url>
cd playlist-game-api

pnpm install          # installe les dépendances + génère le client Prisma (postinstall)

cp .env.example .env  # puis renseigner les variables ci-dessous
```

### Variables d'environnement

| Variable              | Description                                                       |
| --------------------- | ----------------------------------------------------------------- |
| `DATABASE_URL`        | URL Prisma Accelerate (`prisma+postgres://…`)                     |
| `DIRECT_DATABASE_URL` | URL de connexion directe PostgreSQL (utilisée par les migrations) |
| `SENTRY_DSN`          | DSN Sentry (optionnel — monitoring désactivé si absent)           |

### Base de données

```bash
npx prisma migrate dev   # applique les migrations
pnpm dlx tsx prisma/seed.ts  # (optionnel) seed
```

---

## Commandes

| Commande           | Description                                        |
| ------------------ | -------------------------------------------------- |
| `pnpm start:dev`   | Démarre le serveur en mode watch                   |
| `pnpm start:debug` | Mode debug avec watch                              |
| `pnpm build`       | Build de production                                |
| `pnpm start:prod`  | Lance le build (`node dist/main`)                  |
| `pnpm test`        | Tests unitaires                                    |
| `pnpm test:watch`  | Tests unitaires en watch                           |
| `pnpm test:cov`    | Couverture de code                                 |
| `pnpm test:e2e`    | Tests E2E (lance un PostgreSQL via Docker Compose) |
| `pnpm lint`        | Lint + fix (ESLint)                                |
| `pnpm format`      | Formatage (Prettier)                               |

Le serveur démarre sur `http://localhost:3000` (CORS activé).

---

## Docker

```bash
docker build -t playlist-game-api .
docker run -p 3000:3000 --env-file .env playlist-game-api
```

Le Dockerfile utilise un build multi-stage (Node 24-slim) et lance `node dist/src/main.js` en production.

### Docker Compose (tests E2E)

```bash
docker compose -f docker-compose.test.yml up -d
# Démarre un PostgreSQL 16-alpine sur le port 5434
```

---

## Modèle de données

```
User ──┬── Room (host)
       ├── Room (member)
       ├── Game
       ├── Round (themeMaster)
       ├── Pick
       └── Vote (guessUser / guessedUser)

Room ──── Game ──── Round ──── Pick ──── Vote
                                │
                              Track
```

| Modèle    | Description                                                                  | Clé primaire            |
| --------- | ---------------------------------------------------------------------------- | ----------------------- |
| **User**  | Joueur (UUID client-side, nom optionnel)                                     | `id` (UUID)             |
| **Room**  | Salon avec PIN à 6 chiffres, un hôte, N joueurs                              | `id` (autoincrement)    |
| **Game**  | Partie liée à un salon, contient N rounds (1 par joueur)                     | `id` (autoincrement)    |
| **Round** | Manche avec un thème et un meneur (_themeMaster_)                            | `id` (autoincrement)    |
| **Pick**  | Choix d'une chanson par un joueur pour un round — unique `(roundId, userId)` | `id` (autoincrement)    |
| **Track** | Chanson Deezer (titre, artiste, URL preview)                                 | `id` (UUID / Deezer ID) |
| **Vote**  | Guess d'un joueur sur l'auteur d'un pick — unique `(pickId, guessUserId)`    | `id` (autoincrement)    |

---

## API REST

### Health

#### `GET /health` — Health check

Vérifie que le serveur et la base de données sont opérationnels.

**Réponse `200`**

```json
{
  "status": "ok",
  "info": { "database": { "status": "up" } },
  "error": {},
  "details": { "database": { "status": "up" } }
}
```

---

### Room

#### `POST /room` — Créer un salon

Crée un utilisateur (upsert) puis un salon avec un PIN à 6 chiffres aléatoire.

**Body**

```json
{ "id": "uuid", "name": "Alice" }
```

**Réponse `201`**

```json
{ "id": 1, "pin": "482937", "hostId": "uuid" }
```

---

#### `GET /room/:pin` — Récupérer un salon

**Params** : `pin` (string, 6 chiffres)

**Réponse `200`**

```json
{
  "id": 1,
  "pin": "482937",
  "hostId": "uuid",
  "users": [{ "id": "uuid", "name": "Alice" }],
  "host": { "id": "uuid", "name": "Alice" }
}
```

---

#### `PATCH /room/:pin` — Rejoindre un salon

**Params** : `pin` (string)

**Body**

```json
{ "id": "uuid-2", "name": "Bob" }
```

**Réponse `200`** : l'objet Room mis à jour avec la liste des users. Émet `room:updated` via WebSocket.

---

#### `DELETE /room/:id` — Supprimer un salon

**Params** : `id` (number)

**Réponse `200`** : l'objet Room supprimé.

---

#### `DELETE /room/:pin/users/:userId` — Quitter un salon

**Params** : `pin` (string), `userId` (string UUID)

Si le dernier joueur quitte, le salon est supprimé. Si l'hôte quitte, le rôle est transféré.

**Réponse `200`**

```json
{ "users": [...], "hostId": "new-host-uuid" }
```

---

### Game

#### `POST /game` — Lancer une partie

Crée une Game avec autant de Rounds que de joueurs dans le salon.

**Body**

```json
{ "pin": "482937", "userId": "uuid" }
```

**Réponse `201`**

```json
{ "roundId": 1, "gameId": 1 }
```

Émet `game:started` via WebSocket.

---

#### `GET /game/:id` — Récupérer une partie

**Params** : `id` (number)

**Réponse `200`** : objet Game complet avec users, rounds, picks et votes.

---

#### `GET /game/:id/result` — Classement final

**Params** : `id` (number)

**Réponse `200`**

```json
[
  { "user": { "id": "uuid", "name": "Alice" }, "score": 3 },
  { "user": { "id": "uuid-2", "name": "Bob" }, "score": 1 }
]
```

Un point est attribué pour chaque vote correct (le `guessedUserId` correspond au `userId` du pick).

---

#### `PATCH /game/:id/finish` — Terminer une partie

Détache la Game du salon (met `roomId` à `null`) pour permettre de relancer une nouvelle partie.

**Params** : `id` (number)

**Réponse `200`**

```json
{ "finished": true }
```

---

### Round

#### `GET /round/:roundId` — Détails d'un round

**Params** : `roundId` (number)

**Réponse `200`** : objet Round avec themeMaster, game (+ room + users), picks (+ votes + track + user).

---

#### `PATCH /round/:roundId` — Choisir le thème

Seul le themeMaster du round peut définir le thème.

**Body**

```json
{ "theme": "Été 2025", "userId": "uuid", "pin": "482937" }
```

**Réponse `200`** : objet Round mis à jour. Émet `round:themeUpdated` via WebSocket.

---

#### `POST /round/next?pin=:pin` — Manche suivante

Retourne le prochain round sans thème. Émet `round:completed` avec le `nextRoundId` (ou `null` si fin de partie).

**Query** : `pin` (string)

**Réponse `200`**

```json
{ "nextRoundId": 2 }
```

---

### Pick

#### `GET /pick/:pickId` — Détails d'un pick

**Params** : `pickId` (number)

**Réponse `200`**

```json
{
  "id": 1,
  "roundId": 1,
  "trackId": "deezer-id",
  "userId": "uuid",
  "track": {
    "id": "deezer-id",
    "title": "Song",
    "artist": "Artist",
    "previewUrl": "https://..."
  }
}
```

---

#### `GET /pick/search/:text` — Rechercher une chanson

Proxy vers l'API Deezer. Retourne 10 résultats max.

**Params** : `text` (string)

**Réponse `200`**

```json
[
  {
    "id": "123",
    "title": "Song Title",
    "artist": "Artist Name",
    "previewUrl": "https://..."
  }
]
```

---

#### `POST /pick?pin=:pin` — Valider un choix de chanson

Crée ou met à jour le pick d'un joueur pour un round.

**Query** : `pin` (string)

**Body**

```json
{
  "roundId": 1,
  "userId": "uuid",
  "track": {
    "id": "deezer-id",
    "title": "Song",
    "artist": "Artist",
    "previewUrl": "https://..."
  }
}
```

**Réponse `201`**

```json
{ "success": true }
```

Émet `pick:updated` via WebSocket. Si tous les joueurs ont pick, le payload inclut `firstPickId` pour démarrer la phase de vote.

---

#### `DELETE /pick/:roundId/:userId?pin=:pin` — Annuler un choix

**Params** : `roundId` (number), `userId` (string)  
**Query** : `pin` (string)

**Réponse `200`**

```json
{ "success": true }
```

Émet `pick:updated` via WebSocket.

---

### Vote

#### `POST /vote?pin=:pin` — Voter

**Query** : `pin` (string)

**Body**

```json
{ "pickId": "1", "guessId": "uuid-guess", "userId": "uuid-voter" }
```

**Réponse `201`**

```json
{ "success": true }
```

Émet `vote:updated` via WebSocket. Si tous les joueurs ont voté, le payload inclut `nextPickId` (ou `null` si tous les picks ont été votés).

---

#### `DELETE /vote/:pickId/:userId?pin=:pin` — Annuler un vote

**Params** : `pickId` (number), `userId` (string)  
**Query** : `pin` (string)

**Réponse `200`**

```json
{ "success": true }
```

Émet `vote:updated` via WebSocket.

---

## WebSocket (Socket.IO)

Connexion sur `ws://localhost:3000` (même port que le serveur HTTP). Les events sont diffusés aux clients connectés au salon via les rooms Socket.IO (identifiées par le `pin`).

### Events client → serveur

| Event              | Payload           | Description                                                        |
| ------------------ | ----------------- | ------------------------------------------------------------------ |
| `room:subscribe`   | `{ pin, userId }` | Rejoindre la room Socket.IO (vérifie que l'utilisateur est membre) |
| `room:unsubscribe` | `{ pin }`         | Quitter la room Socket.IO                                          |

### Events serveur → client

| Event                | Payload                    | Description                                                                                       |
| -------------------- | -------------------------- | ------------------------------------------------------------------------------------------------- |
| `room:updated`       | `{ users, hostId, pin }`   | Liste des joueurs mise à jour (join / leave / host transfer)                                      |
| `game:started`       | `{ roundId, gameId, pin }` | La partie a démarré, contient l'ID du premier round                                               |
| `round:themeUpdated` | —                          | Le thème du round a été choisi                                                                    |
| `round:completed`    | `{ nextRoundId }`          | Le round est terminé. `nextRoundId` est `null` si c'était le dernier → fin de partie              |
| `pick:updated`       | `{ users, firstPickId? }`  | Un joueur a validé/annulé sa chanson. `firstPickId` présent quand tous ont pick                   |
| `vote:updated`       | `{ users, nextPickId? }`   | Un vote a été enregistré/annulé. `nextPickId` présent quand tous ont voté (`null` = fin du round) |

---

## Structure du projet

```
src/
├── instrument.ts            # Init Sentry (importé en premier dans main.ts)
├── main.ts                  # Bootstrap NestJS (port 3000, CORS)
├── app.module.ts            # Module racine (SentryModule, HealthModule, …)
├── prisma.service.ts        # Client Prisma + extension Accelerate
├── prisma.module.ts         # Module Prisma (global)
├── health/
│   ├── health.module.ts     # Module health check
│   ├── health.controller.ts # GET /health
│   └── prisma.health.ts     # Indicateur santé Prisma
├── room/
│   ├── room.controller.ts   # CRUD salon + leave
│   ├── room.gateway.ts      # WS : room:subscribe / room:unsubscribe / room:updated
│   ├── room.service.ts      # Logique Prisma
│   └── dto/
├── game/
│   ├── game.controller.ts   # Créer / récupérer partie + résultats + finish
│   ├── game.gateway.ts      # WS : game:started
│   ├── game.service.ts      # Création game + calcul scores
│   └── dto/
├── round/
│   ├── round.controller.ts  # Détails round + pick theme + next round
│   ├── round.gateway.ts     # WS : round:themeUpdated / round:completed
│   ├── round.service.ts
│   └── dto/
├── pick/
│   ├── pick.controller.ts   # Assign / cancel song + search Deezer
│   ├── pick.gateway.ts      # WS : pick:updated
│   ├── pick.service.ts
│   ├── musicapi.service.ts  # Proxy Deezer API
│   ├── dto/
│   └── vote/
│       ├── vote.controller.ts  # Create / cancel vote
│       ├── vote.gateway.ts     # WS : vote:updated
│       └── vote.service.ts
├── user/
│   └── user.service.ts      # Upsert utilisateur
└── generated/prisma/        # Client Prisma généré
prisma/
├── schema.prisma
├── prisma.config.ts
├── seed.ts
└── migrations/
```

---

## Déroulement d'une partie

1. **Création du salon** — Un joueur crée un salon (`POST /room`), un PIN à 6 chiffres est généré. Les autres rejoignent via `PATCH /room/:pin`.
2. **Connexion WebSocket** — Chaque joueur émet `room:subscribe` avec son `pin` et `userId` pour recevoir les events en temps réel.
3. **Lancement** — L'hôte appelle `POST /game`. Une Game est créée avec autant de Rounds que de joueurs (chacun sera _themeMaster_ une fois). `game:started` est émis.
4. **Phase thème** — Le themeMaster appelle `PATCH /round/:roundId` avec le thème de son choix. `round:themeUpdated` est émis.
5. **Phase sélection** — Chaque joueur recherche une chanson (`GET /pick/search/:text`) puis valide (`POST /pick`). À chaque validation, `pick:updated` est émis. Quand tout le monde a validé, `firstPickId` est inclus dans le payload.
6. **Phase vote** — Les extraits sont joués un par un. Pour chaque pick, les joueurs votent (`POST /vote`). `vote:updated` est émis à chaque vote. Quand tous ont voté, `nextPickId` indique le pick suivant ou `null` si le round est terminé.
7. **Manche suivante / Fin** — `POST /round/next` retourne le prochain round. `round:completed` est émis avec `nextRoundId` (`null` = fin de partie). Les scores sont disponibles via `GET /game/:id/result`.
8. **Fin de partie** — `PATCH /game/:id/finish` détache la partie du salon pour permettre d'en relancer une nouvelle.

---

## Déploiement (Fly.io)

L'app est configurée pour Fly.io avec migration automatique au deploy :

```toml
[deploy]
  release_command = 'npx prisma migrate deploy'
```

```bash
fly deploy
```

---

## Licence

Projet privé — UNLICENSED
