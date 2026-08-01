# R0 API Foundation Completion Checklist

## Deliverables

- [x] Hono API provides `GET /health` with a `200` response and `{ "status": "ok" }` JSON body.
- [x] Hono API provides `GET /openapi.json` with an OpenAPI 3.1 JSON document.
- [x] API responses provide an `X-Request-Id` header from the received value or a generated value.
- [x] Error responses provide `code`, `message`, `requestId`, and `retryable` JSON fields.
- [x] API tests cover health, OpenAPI, unknown-path error responses, and request ID handling.
- [x] API package provides `npm run dev`, `npm run build`, and `npm start` commands.

## Completion Criteria

- [x] `GET /health` returns its defined status and JSON body.
- [x] `GET /openapi.json` contains the endpoint and response schemas.
- [x] Unknown paths return the defined error response and status.
- [x] All responses include `X-Request-Id`.
- [x] API tests complete successfully.
- [x] `npm run build` completes successfully.
- [x] A running development server returns successful HTTP responses for `/health` and `/openapi.json`.

## Verification Record

| Criterion | Command or request | Result |
| --- | --- | --- |
| API tests | `npm test` | 5 tests passed. |
| TypeScript build | `npm run build` | Completed successfully. |
| Health endpoint | `curl --include http://localhost:3000/health` | `200 OK`, `X-Request-Id`, and `{ "status": "ok" }`. |
| OpenAPI document | `curl --include http://localhost:3000/openapi.json` | `200 OK`, OpenAPI `3.1.0`, `/health`, `Error`, and the health response `X-Request-Id` header schema. |
| Unknown path | `curl --include -H 'X-Request-Id: verify-404' http://localhost:3000/missing` | `404 Not Found`, `X-Request-Id: verify-404`, and the defined error JSON. |
| Generated health request ID | `./node_modules/.bin/tsx --test --test-name-pattern='generates a non-empty request ID' test/app.test.ts` | Passed: `GET /health` returns a non-empty `X-Request-Id` without an incoming ID. |
| Error request ID correlation | `./node_modules/.bin/tsx --test --test-name-pattern='error contract' test/app.test.ts` | Passed: the `X-Request-Id` header equals the `requestId` body field for `404` and `500` responses. |
| API test suite after final review | `npm test` | 6 tests passed. |
| TypeScript build after final review | `npm run build` | Completed successfully. |
