# R0 API Foundation First Unit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide the first Hono API unit with health, OpenAPI, request IDs, and contract tests.

**Architecture:** `src/app.ts` creates an `OpenAPIHono` application and owns public HTTP contracts. `src/index.ts` starts that application with the Node.js adapter. Node’s test runner, executed through `tsx`, verifies the application through `app.request()` without binding a network port.

**Tech Stack:** Node.js, TypeScript, Hono, `@hono/node-server`, `@hono/zod-openapi`, Zod, `tsx`, Node test runner.

## Global Constraints

- Read and record the relevant official Hono Docs before API source changes.
- `GET /health` returns HTTP 200 and `{ "status": "ok" }`.
- `GET /openapi.json` returns OpenAPI 3.1 JSON.
- Error responses provide `code`, `message`, `requestId`, and `retryable` fields.
- Every response provides `X-Request-Id`.
- Keep the Hono application separate from the Node.js startup entry point.

---

## File Structure

| Path | Responsibility |
| --- | --- |
| `apps/api/src/app.ts` | OpenAPI application, request ID middleware, routes, and error responses. |
| `apps/api/src/index.ts` | Node.js HTTP server startup on port 3000. |
| `apps/api/test/app.test.ts` | HTTP contract tests through `app.request()`. |
| `apps/api/package.json` | Dependencies and `test` script. |
| `docs/logs/20260727010000-r0-api-foundation/completion-checklist.md` | Final verification results. |

### Task 1: Application boundary and health contract

**Files:**
- Create: `apps/api/src/app.ts`
- Create: `apps/api/test/app.test.ts`
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/package.json`
- Modify: `apps/api/tsconfig.json`

**Interfaces:**
- Produces: `createApp(registerRoutes?: (app: App) => void): App` for HTTP tests and Node startup.
- Produces: `GET /health` with `200` and `{ status: "ok" }`.

- [ ] **Step 1: Add the test command and write the failing health test**

```json
{
  "scripts": {
    "test": "tsx --test test/**/*.test.ts"
  }
}
```

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { createApp } from '../src/app.js'

test('GET /health returns the API health state', async () => {
  const response = await createApp().request('/health')

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: 'ok' })
})
```

- [ ] **Step 2: Run the health test to verify it fails**

Run: `npm test -- --test-name-pattern='GET /health returns the API health state'`

Expected: FAIL because `src/app.ts` and `createApp` do not exist.

- [ ] **Step 3: Install OpenAPI dependencies and implement the application boundary**

Run: `npm install @hono/zod-openapi zod`

```ts
// src/app.ts
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'

type Variables = { requestId: string }

export type App = OpenAPIHono<{ Variables: Variables }>

const errorSchema = z.object({
  code: z.string(),
  message: z.string(),
  requestId: z.string(),
  retryable: z.boolean(),
})

const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  responses: {
    200: {
      content: { 'application/json': { schema: z.object({ status: z.literal('ok') }) } },
      description: 'API process health state',
    },
    500: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'API processing error',
    },
  },
})

export const createApp = (registerRoutes?: (app: App) => void): App => {
  const app = new OpenAPIHono<{ Variables: Variables }>()
  app.openAPIRegistry.registerComponent('schemas', 'Error', errorSchema)
  app.openapi(healthRoute, (context) => context.json({ status: 'ok' }, 200))
  registerRoutes?.(app)
  return app
}
```

```ts
// src/index.ts
import { serve } from '@hono/node-server'
import { createApp } from './app.js'

serve({ fetch: createApp().fetch, port: 3000 })
```

```json
// tsconfig.json
{
  "exclude": ["node_modules", "test"]
}
```

- [ ] **Step 4: Run the health test and build**

Run: `npm test -- --test-name-pattern='GET /health returns the API health state' && npm run build`

Expected: PASS and a TypeScript build succeeds.

- [ ] **Step 5: Commit the health contract**

```bash
git add apps/api/package.json apps/api/package-lock.json apps/api/src/app.ts apps/api/src/index.ts apps/api/test/app.test.ts apps/api/tsconfig.json
git commit -m "feat: add Hono health endpoint"
```

### Task 2: Request ID and error contracts

**Files:**
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/test/app.test.ts`

**Interfaces:**
- Consumes: `createApp(registerRoutes?: (app: App) => void): App`.
- Produces: `X-Request-Id` on every response.
- Produces: 404 and 500 JSON error responses with `code`, `message`, `requestId`, and `retryable`.

- [ ] **Step 1: Write failing request ID and unknown-path tests**

```ts
test('uses a received request ID for the health response', async () => {
  const response = await createApp().request('/health', {
    headers: { 'X-Request-Id': 'request-123' },
  })

  assert.equal(response.headers.get('X-Request-Id'), 'request-123')
})

test('returns the error contract for an unknown path', async () => {
  const response = await createApp().request('/missing', {
    headers: { 'X-Request-Id': 'request-404' },
  })

  assert.equal(response.status, 404)
  assert.deepEqual(await response.json(), {
    code: 'NOT_FOUND',
    message: 'The requested resource was not found.',
    requestId: 'request-404',
    retryable: false,
  })
})

test('returns the error contract when a route throws', async () => {
  const response = await createApp((app) => {
    app.get('/test-error', () => {
      throw new Error('expected test error')
    })
  }).request('/test-error', {
    headers: { 'X-Request-Id': 'request-500' },
  })

  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), {
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred.',
    requestId: 'request-500',
    retryable: false,
  })
})
```

- [ ] **Step 2: Run the request ID and unknown-path tests to verify they fail**

Run: `npm test -- --test-name-pattern='request ID|unknown path'`

Expected: FAIL because the application does not add the header or define the 404 and 500 response bodies.

- [ ] **Step 3: Implement the common response behavior**

```ts
app.use('*', async (context, next) => {
  const requestId = context.req.header('X-Request-Id') ?? crypto.randomUUID()
  context.set('requestId', requestId)
  await next()
  context.header('X-Request-Id', requestId)
})

app.notFound((context) => context.json({
  code: 'NOT_FOUND',
  message: 'The requested resource was not found.',
  requestId: context.get('requestId'),
  retryable: false,
}, 404))

app.onError((_error, context) => context.json({
  code: 'INTERNAL_ERROR',
  message: 'An unexpected error occurred.',
  requestId: context.get('requestId'),
  retryable: false,
}, 500))
```

Use the typed `App` produced by Task 1 so `context.get('requestId')` remains type-safe. Call `registerRoutes(app)` after the common middleware and error handlers are registered. Task 1 registers `errorSchema` as the `Error` OpenAPI component and defines the health route’s HTTP 500 response.

- [ ] **Step 4: Run the complete API test suite and build**

Run: `npm test && npm run build`

Expected: all tests PASS and TypeScript compilation succeeds.

- [ ] **Step 5: Commit the error contract**

```bash
git add apps/api/src/app.ts apps/api/test/app.test.ts
git commit -m "feat: add API request ID and error contracts"
```

### Task 3: OpenAPI document and running-server verification

**Files:**
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/test/app.test.ts`
- Modify: `docs/logs/20260727010000-r0-api-foundation/completion-checklist.md`

**Interfaces:**
- Consumes: `createApp(): OpenAPIHono` and the shared health and error schemas.
- Produces: `GET /openapi.json` with OpenAPI 3.1 JSON.

- [ ] **Step 1: Write the failing OpenAPI document test**

```ts
test('GET /openapi.json describes the health endpoint and error schema', async () => {
  const response = await createApp().request('/openapi.json')
  const document = await response.json() as {
    openapi: string
    paths: Record<string, unknown>
    components: { schemas: Record<string, unknown> }
  }

  assert.equal(response.status, 200)
  assert.equal(document.openapi, '3.1.0')
  assert.ok('/health' in document.paths)
  assert.ok('Error' in document.components.schemas)
})
```

- [ ] **Step 2: Run the OpenAPI test to verify it fails**

Run: `npm test -- --test-name-pattern='GET /openapi.json describes'`

Expected: FAIL because the application does not expose an OpenAPI document route.

- [ ] **Step 3: Implement the OpenAPI document route**

```ts
app.doc('/openapi.json', {
  openapi: '3.1.0',
  info: { title: 'walk / dog API', version: '0.1.0' },
})
```

Document the `X-Request-Id` response header for the health response.

- [ ] **Step 4: Run automated and HTTP verification**

Run: `npm test && npm run build`

Run: `npm run dev`

Verify in a second terminal:

```bash
curl --include http://localhost:3000/health
curl --include http://localhost:3000/openapi.json
curl --include -H 'X-Request-Id: verify-404' http://localhost:3000/missing
```

Expected: health and OpenAPI return HTTP 200; the unknown path returns HTTP 404 with `X-Request-Id: verify-404` and the defined error JSON.

- [ ] **Step 5: Complete the session checklist and commit final artifacts**

Record each command and HTTP result in `completion-checklist.md`, check every satisfied item, and then run:

```bash
git add apps/api docs/logs/20260727010000-r0-api-foundation docs/specs/2026-07-27-r0-api-foundation-first-unit.md docs/development/2026-07-27-r0-api-foundation-first-unit-plan.md .agents/skills/developing-hono-apis
git commit -m "feat: establish R0 API foundation"
```

## Plan Self-Review

- Spec coverage: Task 1 provides health, Hono application separation, and package commands. Task 2 provides request IDs and the error contract. Task 3 provides OpenAPI and HTTP verification.
- Placeholder scan: the plan defines each file, interface, test, command, and expected result.
- Type consistency: every task uses `createApp(): OpenAPIHono`, `requestId`, `errorSchema`, and the documented endpoint paths.
