# API local development

Create the local environment file from the `apps` directory:

```bash
cd apps
cp .env.example .env.local
```

Generate a migration after changing the Drizzle schema from `apps/api`:

```bash
cd apps/api
npm run db:generate
```

Review the generated SQL in `apps/api/drizzle/`. Apply migrations through the Compose network from `apps`:

```bash
docker compose -f compose.yml up -d postgres --wait
docker compose -f compose.yml run --rm migrate
```

The `migrate` service runs `drizzle-kit migrate` with `DATABASE_URL` from `.env.local`.

Run the database integration suite through the same Compose network:

```bash
docker compose -f compose.yml run --rm migrate npm run test:integration
```

Start PostgreSQL, the one-shot migration service, and the API from the `apps` directory:

```bash
docker compose -f compose.yml up --build -d
curl --include http://localhost:3000/health
docker compose -f compose.yml logs migrate
docker compose -f compose.yml down
```

The health check reports HTTP 200 with `{ "status": "ok" }` and an `X-Request-Id` response header while the API service is running.
