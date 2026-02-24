# 🎵 SoundGuess API

> _Pas besoin de connaître la musique. Il faut connaître les gens._

Backend temps réel pour **SoundGuess**, un jeu mobile multijoueur où chaque manche pose un thème, chaque joueur choisit une chanson anonymement, et les autres doivent deviner qui a choisi quoi.

---

## 🏗️ Stack technique

| Couche               | Technologie                                                             |
| -------------------- | ----------------------------------------------------------------------- |
| **Framework**        | [NestJS](https://nestjs.com/) v11                                       |
| **Langage**          | TypeScript 5.9                                                          |
| **Runtime**          | Node.js 18                                                              |
| **Base de données**  | PostgreSQL (via [Prisma](https://www.prisma.io/) 7 + Prisma Accelerate) |
| **Temps réel**       | WebSockets ([Socket.IO](https://socket.io/) 4)                          |
| **API musicale**     | [Deezer API](https://developers.deezer.com/) (extraits 30s)             |
| **Package manager**  | pnpm                                                                    |
| **Conteneurisation** | Docker (multi-stage build)                                              |

---

## 📦 Prérequis

- **Node.js** >= 18
- **pnpm** >= 8
- **PostgreSQL** (ou une instance Prisma Accelerate)

---

## 🚀 Installation

```bash
# Cloner le repo
git clone <repo-url>
cd playlist-game-api

# Installer les dépendances
pnpm install

# Configurer les variables d'environnement
cp .env.example .env
```

### Variables d'environnement

| Variable              | Description                                                       |
| --------------------- | ----------------------------------------------------------------- |
| `DATABASE_URL`        | URL de connexion Prisma Accelerate                                |
| `DIRECT_DATABASE_URL` | URL de connexion directe PostgreSQL (utilisée par les migrations) |

### Base de données

```bash
# Générer le client Prisma
npx prisma generate

# Appliquer les migrations
npx prisma migrate dev

# (Optionnel) Seed de la base
pnpm dlx tsx prisma/seed.ts
```

---

## ▶️ Lancer le serveur

```bash
# Développement (watch mode)
pnpm start:dev

# Debug
pnpm start:debug

# Production
pnpm build && pnpm start:prod
```

Le serveur démarre sur `http://localhost:3000`.

---

## 🐳 Docker

```bash
docker build -t soundguess-api .
docker run -p 3000:3000 --env-file .env soundguess-api
```

---

## 🧪 Tests

```bash
pnpm test            # Tests unitaires
pnpm test:watch      # Mode watch
pnpm test:cov        # Couverture de code
pnpm test:e2e        # Tests end-to-end
```

---

## 🗄️ Modèle de données

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

| Modèle    | Rôle                                                      |
| --------- | --------------------------------------------------------- |
| **User**  | Joueur identifié par UUID, nom optionnel                  |
| **Room**  | Salon avec PIN à 6 chiffres, un hôte, plusieurs joueurs   |
| **Game**  | Partie liée à un salon, contient N manches (1 par joueur) |
| **Round** | Manche avec un thème et un meneur (_themeMaster_)         |
| **Pick**  | Choix d'une chanson par un joueur pour une manche         |
| **Track** | Chanson (id Deezer, titre, artiste, URL de preview)       |
| **Vote**  | Guess d'un joueur sur l'auteur d'un pick                  |

---

## 🔌 API REST

| Méthode  | Endpoint             | Description                                 |
| -------- | -------------------- | ------------------------------------------- |
| `POST`   | `/room`              | Créer un salon (génère un PIN à 6 chiffres) |
| `GET`    | `/room/:pin`         | Récupérer un salon par PIN                  |
| `PATCH`  | `/room/:pin`         | Rejoindre un salon                          |
| `DELETE` | `/room/:id`          | Supprimer un salon                          |
| `GET`    | `/game/:id`          | Récupérer une partie                        |
| `GET`    | `/game/:id/result`   | Classement final (scores)                   |
| `GET`    | `/round/:roundId`    | Détails d'une manche                        |
| `GET`    | `/pick/:pickId`      | Détails d'un pick                           |
| `GET`    | `/pick/search/:text` | Rechercher une chanson (Deezer API)         |

---

## 📡 WebSocket Events

Toute la logique temps réel passe par un gateway Socket.IO unique.

### Events client → serveur

| Event        | Payload                            | Description                   |
| ------------ | ---------------------------------- | ----------------------------- |
| `joinRoom`   | `{ pin }`                          | Rejoindre un salon            |
| `leaveRoom`  | `{ pin, userId }`                  | Quitter un salon              |
| `startGame`  | `{ pin, userId }`                  | Lancer la partie (hôte)       |
| `pickTheme`  | `{ roundId, theme, pin }`          | Choisir le thème de la manche |
| `validSong`  | `{ roundId, userId, track, pin }`  | Valider son choix de chanson  |
| `cancelSong` | `{ roundId, userId, pin }`         | Annuler son choix             |
| `vote`       | `{ pickId, guessId, userId, pin }` | Voter pour un joueur          |
| `cancelVote` | `{ pickId, userId, pin }`          | Annuler son vote              |
| `nextRound`  | `{ pin, gameId }`                  | Passer à la manche suivante   |

### Events serveur → client

| Event               | Payload                    | Description                                 |
| ------------------- | -------------------------- | ------------------------------------------- |
| `userList`          | `{ users, hostId, pin }`   | Liste des joueurs mise à jour               |
| `gameStarted`       | `{ roundId, gameId, pin }` | La partie a démarré                         |
| `themePicked`       | `{ roundId, pin }`         | Le thème a été choisi                       |
| `songValidated`     | `{ pin, users }`           | Un joueur a validé sa chanson               |
| `allSongsValidated` | `{ pickId, pin }`          | Tous les joueurs ont validé → phase de vote |
| `voteValidated`     | `{ pin, users }`           | Un vote enregistré                          |
| `allVotesValidated` | `{ pickId, pin }`          | Tous les votes enregistrés pour un pick     |
| `voteCanceled`      | `{ pin, users }`           | Un vote annulé                              |
| `songCanceled`      | `{ pin, users }`           | Un choix de chanson annulé                  |
| `newRound`          | `{ roundId, pin }`         | Nouvelle manche                             |
| `goToResult`        | `{ pin }`                  | Fin de partie → afficher les résultats      |

---

## 📁 Structure du projet

```
src/
├── main.ts                  # Bootstrap NestJS (port 3000, CORS activé)
├── app.module.ts            # Module racine
├── prisma.service.ts        # Client Prisma (Accelerate)
├── shared/
│   └── shared.gateway.ts    # Gateway WebSocket (toute la logique temps réel)
├── room/                    # Module Room (CRUD salon)
├── game/                    # Module Game (création partie + résultats)
├── round/                   # Module Round (manches)
├── pick/                    # Module Pick (choix de chanson + recherche Deezer)
│   └── vote/                # Service Vote
├── user/                    # Service User (upsert)
└── generated/prisma/        # Client Prisma généré
prisma/
├── schema.prisma            # Schéma de données
├── seed.ts                  # Script de seed
└── migrations/              # Migrations SQL
```

---

## 🕹️ Déroulement d'une partie

1. **Création du salon** — Un joueur crée un salon (`POST /room`), un PIN à 6 chiffres est généré. Les autres rejoignent via le PIN.
2. **Lancement** — L'hôte émet `startGame`. Une `Game` est créée avec autant de `Round` que de joueurs (chacun sera _themeMaster_ une fois).
3. **Phase thème** — Le meneur émet `pickTheme` avec le thème de son choix.
4. **Phase sélection** — Chaque joueur recherche une chanson (`GET /pick/search/:text`) puis valide (`validSong`). Quand tout le monde a validé, le serveur émet `allSongsValidated`.
5. **Phase vote** — Les extraits sont joués un par un. Pour chaque pick, les joueurs votent (`vote`). À chaque pick complété, le serveur passe au suivant ou termine la manche.
6. **Manche suivante / Fin** — `nextRound` passe à la manche suivante. Quand toutes les manches sont jouées, `goToResult` est émis et les scores sont disponibles via `GET /game/:id/result`.

---

## 📄 Licence

Projet privé — UNLICENSED
