# API local development

## Environment

Create the local environment file from the `apps` directory:

```bash
cd apps
cp .env.example .env.local
```

Set Cognito values in `.env.local` from your local AWS stack (`infra/README.md`). The API refuses to start without `AWS_REGION`, `COGNITO_USER_POOL_ID`, and `COGNITO_CLIENT_ID`.

For Docker Compose, keep `POSTGRES_HOST=postgres`. When running migrations or the API directly on the host, override to `POSTGRES_HOST=127.0.0.1`.

`AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` must be set for the worker to reach DynamoDB Local and ElasticMQ. The example values (`local` / `local`) satisfy the local emulators.

## Database migrations

Generate a migration after adding or changing a Drizzle schema from `apps/api`:

```bash
cd apps/api
npm run db:generate
```

Review the generated SQL in `apps/api/drizzle/`. Apply a generated migration from `apps/api` with `POSTGRES_*` configured. From the host machine, point at the published Postgres port:

```bash
POSTGRES_HOST=127.0.0.1 npm run migrate
```

## Docker Compose

Start PostgreSQL, ElasticMQ, DynamoDB Local, the worker, and the API from the `apps` directory:

```bash
docker compose -f compose.yml up --build -d
curl --include http://localhost:3000/health
docker compose -f compose.yml down
```

Compose services:

| Service | Role |
| --- | --- |
| `postgres` | Owner, Dog, Walk, and related business data |
| `elasticmq` | SQS-compatible queue for TrackPoint messages (`track-points`) |
| `dynamodb` | DynamoDB Local for confirmed TrackPoints |
| `worker` | Long-polls SQS and writes TrackPoints to DynamoDB |
| `api` | HTTP API on port 3000 |

## Health check

`GET /health` confirms the API process, worker process, and PostgreSQL are reachable.

When all three are available:

```http
HTTP/1.1 200 OK
Content-Type: application/json

{"status":"ok"}
```

When the worker or PostgreSQL is in a retryable unavailable state:

```http
HTTP/1.1 503 Service Unavailable
Content-Type: application/json

{"code":"DEPENDENCY_UNAVAILABLE","message":"A required dependency is unavailable.","requestId":"…","retryable":true}
```

### Troubleshooting `503 DEPENDENCY_UNAVAILABLE`

1. Confirm all Compose services are running: `docker compose -f compose.yml ps`
2. Check the worker logs: `docker compose -f compose.yml logs worker`
3. Verify `.env.local` includes `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` for local emulators
4. Confirm `WORKER_HEALTH_URL=http://worker:3001/health` inside Compose (use `http://localhost:3001/health` only when pinging the worker from the host)

## Quality checks

From `apps/api`:

```bash
npm test
npm run check
```
