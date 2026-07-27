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
