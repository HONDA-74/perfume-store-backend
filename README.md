# Luxury Perfume Store API

Production-ready RESTful API for a premium perfume e-commerce platform, built with NestJS,
TypeScript, and MongoDB.

> **Status:** Infrastructure scaffold only. No business features (auth, catalog, cart, orders)
> are implemented yet — see `IMPLEMENTATION_PLAN.md` for the build sequence.

## Documentation — Single Source of Truth

Every implementation decision in this repository follows these documents, in this order of
precedence:

1. `AI_RULES.md`
2. `PROJECT_CONTEXT.md`
3. `SYSTEM_ARCHITECTURE.md`
4. `DATABASE_DESIGN.md`
5. `API_BLUEPRINT.md`
6. `IMPLEMENTATION_PLAN.md`

## Tech Stack

- NestJS + TypeScript
- MongoDB + Mongoose
- Passport + JWT
- Swagger (OpenAPI)
- Docker
- Cloudinary
- class-validator / class-transformer
- ESLint + Prettier + Husky + lint-staged

## Project Structure

```text
src/
├── common/        # Cross-cutting NestJS building blocks (guards, filters,
│                   interceptors, pipes, middlewares, decorators, constants, types)
├── config/         # Namespaced, validated configuration (app, database, jwt,
│                   cloudinary, throttler)
├── database/       # Mongoose connection + shared base schema
├── shared/         # Reserved for pure, framework-agnostic utilities (currently empty)
├── modules/        # Feature modules (auth, users, products, categories, brands,
│                   cart, wishlist, orders, uploads) — one bounded context each
├── app.module.ts
└── main.ts
```

Full rationale for every folder lives in `SYSTEM_ARCHITECTURE.md` §3–7.

## Getting Started

### Prerequisites

- Node.js ≥ 20
- npm
- MongoDB (local instance or Docker)

### Installation

```bash
npm install
cp .env.example .env
# fill in .env — see "Environment Variables" below
```

### Running Locally

```bash
npm run start:dev     # watch mode
npm run start          # standard start
npm run start:prod     # run compiled build (after `npm run build`)
```

The API listens under the global prefix `api/v1` (e.g. `http://localhost:3000/api/v1`).
Swagger docs are served at `http://localhost:3000/api/docs` when `SWAGGER_ENABLED=true`.

### Running with Docker

```bash
docker compose up --build
```

This starts the API container alongside a MongoDB container with a persisted volume.
Ensure `.env` exists in the project root before running — `docker-compose.yml` reads it via
`env_file`.

## Environment Variables

All variables are documented in `.env.example` and validated at startup (`src/config/validation.schema.ts`)
— the application refuses to boot if a required variable is missing or invalid.

| Variable | Purpose |
|---|---|
| `NODE_ENV` | `development` \| `production` \| `test` |
| `PORT` | HTTP port |
| `API_PREFIX` | Global route prefix (also the API version, e.g. `api/v1`) |
| `APP_TRUST_PROXY` | Enable `trust proxy` when running behind a reverse proxy/load balancer |
| `BODY_LIMIT` | Max request body size |
| `CORS_ORIGIN` | Comma-separated allowed origins |
| `MONGODB_URI` | MongoDB connection string |
| `MONGODB_RETRY_ATTEMPTS` / `MONGODB_RETRY_DELAY` | Connection retry behavior |
| `JWT_ACCESS_SECRET` / `JWT_ACCESS_EXPIRY` | Access token signing |
| `JWT_REFRESH_SECRET` / `JWT_REFRESH_EXPIRY` | Refresh token signing |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` / `CLOUDINARY_UPLOAD_FOLDER` | Image storage |
| `THROTTLE_TTL` / `THROTTLE_LIMIT` | Global rate limiting |
| `THROTTLE_AUTH_TTL` / `THROTTLE_AUTH_LIMIT` | Stricter rate limiting reserved for `/auth/*` (applied when Auth is implemented) |
| `SWAGGER_ENABLED` / `SWAGGER_PATH` | API documentation |

Secrets are never hardcoded and never committed (`AI_RULES.md` §24).

## Coding Standards

This project follows `AI_RULES.md` in full. Highlights:

- **Architecture:** Clean Modular Architecture, organized by feature (`SYSTEM_ARCHITECTURE.md` §1–4).
- **Layering:** Controllers = HTTP only, Services = business logic, Schemas = persistence only,
  DTOs = validation only.
- **Naming:** kebab-case files, PascalCase classes.
- **Responses:** every success/error response conforms to the standardized envelope
  (`AI_RULES.md` §19).
- **Validation:** every payload passes through the global `ValidationPipe`
  (`whitelist`, `forbidNonWhitelisted`, `transform`).
- **Dependency direction:** see `SYSTEM_ARCHITECTURE.md` §4 — e.g. `Users` is a leaf module and
  must never depend on feature modules.

Before contributing, run:

```bash
npm run lint
npm run format
npm run build
npm test
```

Husky + lint-staged automatically run ESLint and Prettier on staged files before each commit.

## Scripts

| Script | Purpose |
|---|---|
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start` / `start:dev` / `start:debug` / `start:prod` | Run the application |
| `npm run lint` / `lint:fix` | Lint the codebase |
| `npm run format` | Format with Prettier |
| `npm test` / `test:watch` / `test:cov` | Unit tests (Jest) |
| `npm run test:e2e` | End-to-end tests |

## Roadmap

See `IMPLEMENTATION_PLAN.md` for the full milestone sequence (M0–M12). This scaffold completes
**M0 (Bootstrap & Tooling)** and **M1 (Core Infrastructure)**. Feature implementation
(Auth, Users, Products, …) begins at **M2**.
