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
