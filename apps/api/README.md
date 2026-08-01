# API local development

Create the local environment file from the template:

```bash
cp ../.env.example ../.env.local
```

Generate a migration after changing the Drizzle schema:

```bash
npm run db:generate
```

Review the generated SQL in `drizzle/`, then apply the migrations:

```bash
npm run migrate
```

Run the database integration suite with PostgreSQL available from the local environment:

```bash
npm run test:integration
```

Start PostgreSQL, the one-shot migration service, and the API from the `apps` directory:

```bash
docker compose -f compose.yml up --build -d
curl --include http://localhost:3000/health
docker compose -f compose.yml logs migrate
docker compose -f compose.yml down
```

The health endpoint returns HTTP 200 with `{ "status": "ok" }` and an `X-Request-Id` response header.
