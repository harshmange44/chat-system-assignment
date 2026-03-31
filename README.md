# Chat Take-Home (Monorepo)

This project implements a simple real-time chat experience using:

- `apps/web`: React + Vite + TypeScript + Tailwind CSS
- `apps/api`: NestJS + Socket.IO + TypeORM backend
- `packages/shared-types`: shared TypeScript contracts used by web + api
- Redis adapter support for multi-instance Socket.IO broadcasts
- **Postgres** (e.g. hosted on Supabase) for persistence — **auth is in-house (JWT + bcrypt)** so you are not tied to Supabase Auth email rate limits

## Why these choices

- **Monorepo** keeps frontend/backend changes aligned and easy to run.
- **Socket.IO + NestJS gateway** gives instant message delivery and room broadcasts.
- **TypeORM entities + indexes** provide explicit DB modeling and production-friendly query paths.
- **JWT + bcrypt** in the API: register/login without a third-party auth provider; Bearer tokens work for REST and Socket.IO.
- **Redis adapter** enables cross-instance pub/sub for horizontally scaled chat nodes.
- **Typing indicator** is the extra UX feature to make conversation feel live.

## Implemented experience

- Send messages in real-time
- See messages from others appear live
- **Display names** on every message (from `profiles`, set at **sign up** and via `PUT /profiles/me`)
- **WhatsApp-style layout**: conversation list (General channel + direct messages), pick a thread to load history and chat
- **Direct messages**: search people by name, **New chat** → open or create a 1:1 thread (`POST /conversations/dm`)
- **Sign in / sign up** via the API (`POST /auth/login`, `POST /auth/register`) — no Supabase Auth
- Persist chat history in Postgres (`users`, `profiles`, `conversations`, `conversation_members`, `messages`)
- Searchable user profiles (`profiles` table: display name + email)
- Typing indicator (`{name} is typing...`)

### Assignment scope (one room vs many)

The brief leaves this open (“Should there be one chat or multiple conversations?”). This project implements **multiple conversations**: a shared **General** channel plus **1:1 DMs**, so it behaves like a small real product. A **single global room** would also be valid; we chose threads to demonstrate routing, access checks, and a clearer “who am I talking to?” UI.

## Quick start

1. Install dependencies:

```bash
pnpm install
```

2. Copy env files:

```bash
cp apps/web/.env.example apps/web/.env
cp apps/api/.env.example apps/api/.env
```

3. Fill in values:

| Variable | Where |
|----------|--------|
| `DATABASE_URL` | Postgres connection string (Supabase **Database** settings, or any Postgres). |
| `JWT_SECRET` | Long random secret (e.g. `openssl rand -base64 48`). **Required for production.** |
| `JWT_EXPIRES_IN` | Optional, default `7d` (see `jsonwebtoken` / Nest JWT docs). |
| `CORS_ORIGIN` | Include `http://localhost:5173` for local Vite. |
| `REDIS_URL` | Optional: `redis://localhost:6379` for the Socket.IO Redis adapter. |

**Frontend** (`apps/web/.env`):

- `VITE_API_URL` — default `http://localhost:3000` if the API runs locally on port 3000.

**Backend** (`apps/api/.env`):

- `DATABASE_URL` — Postgres URI for TypeORM + migrations.
- `JWT_SECRET`, `JWT_EXPIRES_IN` — sign and expiry for access tokens.
- `AUTH_REQUIRED` — default `true`; set `false` only if you want anonymous Socket.IO demo clients (omit token).
- `CORS_ORIGIN` — include `http://localhost:5173` so the Vite app can call the API.
- `REDIS_URL` — set to `redis://localhost:6379` when using local Redis (`docker compose up -d redis`). Omit to use Socket.IO’s in-memory adapter only (single process).

4. Apply database schema (TypeORM migrations). Requires `DATABASE_URL` in `apps/api/.env`:

```bash
pnpm migration:run
```

Runs from `apps/api` via `tsx` so TypeORM can load `data-source.ts` and entity imports. Run `pnpm install` from the repo root so `tsx` is installed.

5. Start all apps (Turbo):

```bash
pnpm dev
```

Or run individually:

```bash
pnpm dev:api
pnpm dev:web
```

If the API prints `Cannot find module '.../dist/main'`, run `pnpm --filter api build` once, or rely on `dev` / `start:dev` (they run `nest build` before `nest start --watch` so `dist/main.js` exists).

6. Open two browser tabs at `http://localhost:5173`, register two accounts, and chat between them.

### Migrating from an older Supabase-Auth-based checkout

If you previously used Supabase Auth, run the new migrations and set `JWT_SECRET`. Existing **profile** rows are migrated to a **`users`** row with a placeholder password hash (you cannot log in as those users until you **register again** with the same email or run a custom password reset). Prefer a fresh database for demos.

## Backend structure

- `apps/api/src/common/entities`: TypeORM models
- `apps/api/src/migrations`: TypeORM migrations (source of truth for Postgres schema)
- `apps/api/src/data-source.ts`: datasource file for the TypeORM CLI
- `apps/api/src/auth`: register/login, JWT verification (`POST /auth/register`, `POST /auth/login`, `GET /auth/me`)
- `apps/api/src/profile`: profile search + upsert (`GET /profiles/search`, `PUT /profiles/me`)
- `apps/api/src/chat/chat.controller.ts`: REST message history
- `apps/api/src/chat/chat.service.ts`: message persistence
- `apps/api/src/conversation/conversation.controller.ts`: conversation list + create DM
- `apps/api/src/chat/chat.gateway.ts`: Socket.IO realtime events (`room:join` / `message:send` use `conversationId`)
- `apps/api/src/adapters/redis-io.adapter.ts`: Redis pub/sub adapter for scale-out

## Database options

- **Primary**: any Postgres reachable via `DATABASE_URL` (Supabase’s DB is fine; you do not need Supabase Auth).
- **Schema**: TypeORM migrations in `apps/api/src/migrations` (run with `pnpm migration:run`)
- Optional: set `DB_MIGRATIONS_RUN=true` to apply migrations on API startup (usually prefer running migrations in CI/deploy)

## Redis (local via Docker)

Start Redis before the API if you use `REDIS_URL` (recommended so local dev matches scaled Socket.IO behavior):

```bash
docker compose up -d redis
```

Default URL in `apps/api/.env.example`: `REDIS_URL=redis://localhost:6379` (maps to the `redis` service in `docker-compose.yml`).

Stop when done: `docker compose down` (add `-v` to drop the named volume).

## Sticky connections (production)

- With the Redis adapter, broadcasts work across multiple API instances; sticky sessions at the load balancer are optional and depend on your deployment.
- Sticky sessions are typically configured at load balancer/proxy level (e.g. Nginx/ALB) if you need WebSocket upgrades pinned to one node.

## Auth API

- `POST /auth/register` — body `{ "email", "password", "displayName" }` — creates `users` + `profiles`, returns `{ accessToken, user }`.
- `POST /auth/login` — body `{ "email", "password" }` — returns `{ accessToken, user }`.
- `GET /auth/me` — `Authorization: Bearer <accessToken>` — returns `{ id, email }`.

## Profiles API (Bearer access token)

All routes require `Authorization: Bearer <access_token>` (same JWT as login).

- `GET /profiles/search?q=alice&limit=20` — case-insensitive substring search on `displayName` (Postgres `pg_trgm` index).
- `GET /profiles/me` — current user’s row.
- `PUT /profiles/me` — body `{ "displayName": "Alice" }`; `email` is taken from the JWT (not client-supplied).

## Conversations API (Bearer access token)

- `GET /conversations` — list **General** plus your DMs (peer display name, last activity).
- `POST /conversations/dm` — body `{ "peerUserId": "<uuid>" }` — find or create a 1:1 conversation and return its summary.

Run `pnpm migration:run` after pulling so `users`, `profiles`, `conversations`, `conversation_members`, and `messages` exist.

## Notes on trade-offs

- **General** uses a fixed conversation id (`GENERAL_CONVERSATION_ID` in `@chat-system/shared-types`); any signed-in user can read/write without a membership row. DMs require membership in `conversation_members`.
- Socket auth validates JWTs during connection setup; join/send/typing check conversation access before broadcasting.
- **`profiles.id`** references **`users.id`** (application-managed accounts; not Supabase `auth.users`).
- **Groups** are modeled in the schema (`kind` on `conversations`) but not exposed in the UI yet—easy to extend from the same tables.
