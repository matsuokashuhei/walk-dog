# R0 PostgreSQL and Local Docker Development Implementation Plan

**Goal:** Provide a reusable PostgreSQL connection foundation and a local Docker Compose environment for the Hono API.

**Architecture:** The API validates database settings, creates one Drizzle client backed by one `pg.Pool`, and closes the pool during shutdown. Compose starts PostgreSQL and starts the API after the PostgreSQL healthcheck succeeds. Drizzle Kit configuration remains ready for a future schema migration.

## Global Constraints

- `DATABASE_URL` is required and uses the `postgresql://` URL scheme.
- `DATABASE_POOL_MAX` is a positive integer and defaults to `10`.
- The API owns one PostgreSQL pool and closes it during shutdown.
- PostgreSQL becomes healthy before the API starts.
- `drizzle-kit generate` is followed by SQL review before `drizzle-kit migrate` is run for a future schema.

## Tasks

### Task 1: Database configuration and client

- Validate `DATABASE_URL` and `DATABASE_POOL_MAX`.
- Create the Drizzle PostgreSQL client from a `pg.Pool`.
- Close the pool after HTTP server shutdown, including the server-close error path.

### Task 2: Drizzle Kit configuration

- Keep PostgreSQL dialect and migration output configuration in `drizzle.config.ts`.
- Keep `db:generate` and `migrate` scripts available for the next schema addition.

### Task 3: Local Compose environment

- Provide PostgreSQL 16 with credentials from `.env.local`, port `5432`, persistent volume, and `pg_isready` healthcheck.
- Start the API after the PostgreSQL service reports `service_healthy`.
- Provide the API image, environment template, and local development README.

### Task 4: Verification

- Run the API unit suite and TypeScript build.
- Validate Compose configuration.
- Start PostgreSQL and API, then verify `/health` returns HTTP 200 and `X-Request-Id`.
