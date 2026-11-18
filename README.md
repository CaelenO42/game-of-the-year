<h1 align="center">
<a href="https://game-of-the-year.onrender.com" target="_blank">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./public/images/goty_logo_dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="./public/images/goty_logo_light.svg">
  <img alt="Game of the Year Logo" src="./public/images/goty_logo_light.svg">
</picture>
</a>
<br>
Game of the Year 
</h1>
<h4 align="center">Rate, review and track the games you play.</h4>

<div align="center">
    <a style="text-decoration: none;" href="https://github.com/CaelenO42/game-of-the-year/commits/main">
    <img src="https://img.shields.io/github/last-commit/CaelenO42/game-of-the-year.svg?style=flat-square&logo=github&logoColor=white" alt="GitHub last commit">
   </a>
    <a style="text-decoration: none;" href="https://github.com/CaelenO42/game-of-the-year/issues">
    <img src="https://img.shields.io/github/issues-raw/CaelenO42/game-of-the-year.svg?style=flat-square&logo=github&logoColor=white" alt="GitHub issues">
         </a>
    <a style="text-decoration: none;" href="https://github.com/CaelenO42/game-of-the-year/pulls">
    <img src="https://img.shields.io/github/issues-pr-raw/CaelenO42/game-of-the-year.svg?style=flat-square&logo=github&logoColor=white" alt="GitHub pull requests">
   </a>
</div>
<div align="center">

[Features](#features) • [Tech Stack](#tech-stack) • [APIs Used](#apis-used) • [DB & Data Model](#database-and-data-model) • [Auth](#authentication-and-authorization) • [Private API](#private-api) • [Real-time Updates](#real-time-updates) • [Setup & Running](#setup-and-running) • [Deployment](#deployment) • [Known Limitations](#known-limitations) • [Future Improvements](#future-improvements)

</div>

## Features

- Search games (IGDB) and view game pages with genres, platforms and cover art
- Rate games 0 to 100, set a play status, and keep favorites and a library
- Write reviews with spoiler warnings, and browse them per game
- Live updates: ratings and reviews change in every open window (SSE)
- Sign in with Firebase; `user` and `admin` roles
- Admin tools: manage roles, ban users, delete reviews
- Private JSON API with per-user API keys and [interactive docs](https://game-of-the-year.onrender.com/api/docs/)

## Tech Stack
![Stack](https://skillicons.dev/icons?i=nodejs,ts,express,postgres,docker,firebase,githubactions)

| Layer | Technology |
|---|---|
| Runtime and language | Node.js, TypeScript (ESM, strict) |
| Web framework | Express 5 |
| Views | Nunjucks (server-rendered) + htmx |
| Database | PostgreSQL 18 (`pg`, raw parameterized SQL), Neon in production |
| Auth | Firebase Authentication + DB-backed sessions |
| Real-time | Server-Sent Events |
| External APIs | IGDB, Steam, Twitch |
| Testing and CI | Vitest, GitHub Actions |
| Hosting | Render (app), Neon (database) |

## APIs Used

| API | Type | Used for | 
|---|---|---|
| ![IGDB](https://img.shields.io/badge/IGDB-9147ff?logo=twitch&logoColor=white) | Public (API Key) | Game search and details |
| ![Steam](https://img.shields.io/badge/Steam-242424?logo=steam&logoColor=white) | Public | Additional info on PC games & store data |
| ![Twitch](https://img.shields.io/badge/Twitch-9146FF?logo=twitch&logoColor=white) | Public (API Key) | Integrate currently live streamers for supported games |
| ![Swagger](https://img.shields.io/badge/Game_of_the_Year_API-85EA2D?logo=swagger&logoColor=black) | Private (API Key) | Our own api served at `/api/v1/`, [docs](https://game-of-the-year.onrender.com/api/docs/)

## Database and Data Model
This project uses PostgreSQL as our relational database management system. PostgreSQL was chosen for its strong relational integrity, support for hybrid relational/document storage (`JSONB` for storing 3rd party API payloads), and built in performance features like generated columns, and `pg_trgm` for fast fuzzy text searching.

The database contains 13 tables across four main areas:
### Game Catalog & Data
- `game`: Master game table storing important details like name, summary, release date, cover art, computed popularity metrics, and raw `JSONB` data from IGDB.
- `game_steam`: An additional table storing Steam-specific metadata, metacritic scores, and review counts
- `platform` & `genre`: Lookup tables defining game platforms and genres
- `game_platform` & `game_genre` tables that handle the many-to-many relationships between games, platforms, and genres
- `game_external_id`: Maps internal game IDs to external identifiers like IGDB, Twitch, and Steam

### User Accounts & Authentication
- `app_user`: stores user profile data, roles, moderation status, and links to firebase auth via `firebase_uid`
- `username_reservation`: Holds previous usernames for a set window after a user changes their name
- `user_session`: Tracks active login sessions using hashed tokens, device metadata, and expiration timestamps

### User Library, Ratings & Reviews
- `user_game`: Links users to games and tracks library, status, 0-100 rating, and favorites
- `user_review`: Stores written reviews per user per game including spoiler flags, and timestamps

### Private API Access
- `api_key`: Stores API keys issued to authenticated users. The keys are stored hashed with a `key_prefix`, and timestamps.

### ER Diagram
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/img/er_diagram_dark.png">
  <source media="(prefers-color-scheme: light)" srcset="./docs/img/er_diagram_light.png">
  <img alt="Database diagram" src="./docs/img/er_diagram_light.png">
</picture>

### Design decisions

- **Ratings are computed, not stored on `game`.** Averages and counts come from `user_game` with `AVG`/`COUNT`, so the rating is always fresh without having to write to `game`.
- **One `user_game` row per user and game**, keyed by `(user_id, game_id)`. Status, rating, favorite and library are independent nullable columns, and the row is deleted when the last one is cleared.
- **Ratings are stored on a 0 to 100 scale.** Smaller scales (stars, 10-point) are a display detail, so the data never needs converting.
- **Real columns for what we filter, sort or join on; `JSONB` for the rest.** Everything IGDB returns is kept in `igdb_data`, and only fields we query have their own columns.
- **`popularity` is a generated column** computed from IGDB's rating count, so search ranking can change formula without a data migration.
- **Game pages read from our database first** and fall back to IGDB when a game is missing or stale, which keeps us under IGDB's rate limit.
- **Secrets are hashed.** Session tokens and API keys are random values stored only as SHA-256 hashes, and an API key is shown once at creation.
- **Foreign keys cascade.** Deleting a user or a game removes its reviews, ratings, sessions and keys, so no orphaned rows are left behind.
- **All SQL is parameterized** (`$1`, `$2`). Values are never interpolated into query strings.

## Authentication and Authorization

### Authentication

- **Sign-in with Firebase.** The browser signs in with Firebase Authentication. 
- **Our own sessions.** The browser sends the Firebase ID token to `POST /auth/session`. The server verifies it (and rejects it if the sign-in is more than 5 minutes old), creates or updates the user, and starts a session in our `user_session` table.
- **Session cookie.** The cookie holds a random token. Only its hash is stored in the database, so a database leak can't be used to hijack sessions. The cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` in production.
- **Expiry.** Sessions last 30 days and extend while in use (updated at most every 5 minutes). Logging out deletes the session.
- **Bans take effect immediately.** A banned user's sessions are deleted and their token no longer resolves to a user.
- **Onboarding.** New users must pick a username before using the site.

### Authorization

| | Guest | User | Admin |
|---|---|---|---|
| Browse games, reviews and live stats | yes | yes | yes |
| Rate, set status, favorite, review | no | own data only | own data only |
| Create and revoke own API keys | no | yes | yes |
| Delete any review | no | no | yes |
| Manage users (change roles, ban and unban) | no | no | yes |

- Enforced by middleware: `requireAuth` for logged-in routes and `requireRole('admin')` for everything under `/admin`. Authorization is checked on the server for every request.
- Actions on user data (ratings, reviews, keys) always use the logged-in user's id from the session, never an id from the request.

### API keys

The private API (`/api/v1`) uses per-user API keys sent as `Authorization: Bearer <key>`. Keys are random, stored only as SHA-256 hashes, shown once when created, and limited to 5 per user. A key acts as its owner and stops working if that user is banned.

## Private API

The private JSON API lives at `/api/v1` and needs an API key. Interactive docs, with a "Try it out" button, are at [/api/docs/](https://game-of-the-year.onrender.com/api/docs/).

**Get a key:** sign in, open `/settings/api-keys`, and create one. The full key is shown once, so copy it then.

```bash
curl -H "Authorization: Bearer goty_your_key_here" \
  https://game-of-the-year.onrender.com/api/v1/me
```

| Method | Path | Description |
|---|---|---|
| GET | `/me` | The owner of the key |
| GET | `/games/:id` | Game details |
| GET | `/games/:id/stats` | Average rating and rating count |
| GET | `/games/:id/rating` | Your rating for a game |
| PUT | `/games/:id/rating` | Set your rating |
| DELETE | `/games/:id/rating` | Remove your rating |

Errors are always JSON responses, like `{ "error": "message" }`.


## Real-time updates
Pages update live, with no refresh, using **Server-Sent Events (SSE)**.

- Updates a game's rating statistics and its review list, on the game page and the full reviews page.
- Fires when a user rates a game, writes or deletes a review, an admin deletes a review, or a rating is set or removed through the API.
- **How it works:**
  1. A game page opens a connection to `GET /game/:id/events`.
  2. The server keeps open connections grouped by channel (`game:<id>`), so only people viewing that game are notified.
  3. When the data changes, the server sends a small event (`stats-changed` or `reviews-changed`).
  4. The browser reacts by re-fetching just that part of the page (htmx), so the HTML always comes from the server.

## Setup and Running

### Prerequisites
Node.js v24.14.1 or newer, Docker (for Postgres), a Firebase project, a Twitch developer app.

### 1. Environment variables
Copy `.env.example` to `.env`.

| Variable | Purpose | Where to get it |
|---|---|---|
| `DATABASE_URL` | Postgres connection string | Matches the Postgres values below, e.g. `postgres://user:pass@localhost:5432/goty` |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Used by `compose.yml` to create the local database | Choose any values |
| `TWITCH_CLIENT_ID`, `TWITCH_TOKEN` | IGDB and Twitch API access | Twitch developer console: create an app, then generate a token |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Path to the Firebase service account JSON | Firebase console, Project settings, Service accounts |
| `NODE_ENV` | `development` or `production` | |

### 2. Firebase
Enable Email/Password sign-in. Put your web app config in `client/lib/firebase.ts`
and save the service account key at the path above.

### 3. Install Dependencies & Setup DB
Install the dependencies:
```bash
npm install
```
Make sure the PostgresDB is running, you can use the bundled `compose.yml` with:
```bash
docker compose up -d
```
Initialize the database schema and seed the `genre` and `platform` tables with:
```bash
npm run db:init
npm run db:seed
```

Build the client javascript files:
```bash
npm run build:client
```

Start the development server:
```bash
npm run dev
```

Open Game of the Year:
```text
http://localhost:3000/
```

### Tests
The tests run against a separate database named `goty_test` and refuse to run against anything else.

1. Create `.env.test` (copy `.env`, and point `DATABASE_URL` at `.../goty_test`, port `5433`).
2. Start the test database: 

   ```bash
   docker compose --profile test up -d db-test
   ```

3. Apply the schema: 

   ```bash
   npm run db:init:test
   ```

4. Run the tests: 

   ```bash
   npm test
   ```


## Deployment

The app is live at **<https://game-of-the-year.onrender.com>**.

| Piece | Where it runs |
|---|---|
| Web app | Render web service, deployed from the `main` branch |
| Database | Neon PostgreSQL |
| Authentication | Firebase Authentication |

**Render settings**
- Build command: `npm ci --include=dev && npm run build`
- Start command: `node dist/server.js`
- Environment variables are set in the Render dashboard: `NODE_ENV=production`, `DATABASE_URL`, `TWITCH_CLIENT_ID`, `TWITCH_TOKEN` and `FIREBASE_SERVICE_ACCOUNT_PATH`. (`firebaseServiceAccount.json` is added as a Secret File)
- Health check: `/healthz`.

**Database setup:** after changing `db/schema.sql`, apply it to the production database by running `npm run db:init` with the Neon `DATABASE_URL`. The schema is safe to run again.

**CI:** every push and pull request runs the type check and the test suite against a throwaway Postgres in GitHub Actions (`.github/workflows/ci.yml`).

## Known Limitations

- Live updates keep connections in server memory, so they only work with one server instance.
- API keys have no scopes: a key can do everything its owner can. The API only covers game info, stats and your own rating.
- Review links include the author's username, so they break if that user changes their name.
- There are no automated tests for the HTTP routes yet. The data layer, validators and serializers are tested, and routes are checked by hand.
- Only rating changes trigger live updates. Status, favorites and library changes show up after a refresh.

## Future Improvements

- Comments on reviews, with live updates
- Yearly and all-time charts with platform and genre filters
- Importing a Steam library and tracking achievements
- A favorites showcase on profiles
- API support for status, favorites, library and reviews, plus per-key scopes
- Content filtering for reviews and comments
- Review likes and reports
- Critic scores from OpenCritic
- Location shown on sessions
