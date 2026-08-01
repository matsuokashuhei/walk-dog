# API local development

Create the local environment file from the `apps` directory:

```bash
cd apps
cp .env.example .env.local
```

Generate a migration after adding or changing a Drizzle schema from `apps/api`:

```bash
cd apps/api
npm run db:generate
```

Review the generated SQL in `apps/api/drizzle/`. Apply a generated migration from `apps/api` with `DATABASE_URL` configured:

```bash
npm run migrate
```

Start PostgreSQL and the API from the `apps` directory:

```bash
docker compose -f compose.yml up --build -d
curl --include http://localhost:3000/health
docker compose -f compose.yml down
```

The health check reports HTTP 200 with `{ "status": "ok" }` and an `X-Request-Id` response header while the API service is running.
