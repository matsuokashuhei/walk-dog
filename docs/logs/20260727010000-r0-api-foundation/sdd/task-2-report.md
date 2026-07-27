# Task 2 report: Request ID and error contracts

## Status

Completed. The application emits `X-Request-Id` after every handled request, preserves a received value, and returns the specified JSON contract for unknown paths and unhandled route errors.

## Files

- Modified: `apps/api/src/app.ts`
- Modified: `apps/api/test/app.test.ts`

## Sources read

- Official Hono documentation repository tree
- Official Hono Middleware guide
- Official Hono Context API reference
- Official Hono App API reference
- Official Hono Testing guide
- Repository `developing-hono-apis` skill

Decision: register a global middleware before application handlers. It stores the received request ID or `crypto.randomUUID()` in the typed context, awaits downstream routing, then adds the response header. Register `notFound` and `onError` before optional test routes so both use the typed `requestId` and return the shared error shape.

## TDD evidence

### RED

Command: `npm test -- --test-name-pattern='request ID|unknown path'`

Result: 3 failures as expected. The health response had no `X-Request-Id`; the unknown-path response could not be parsed as the required JSON error contract; and the thrown route response could not be parsed as the required JSON error contract.

### GREEN

Command: `npm test && npm run build`

Result: 4 tests passed, 0 failed; TypeScript compilation completed successfully.

## Commit

`f8fc1eb6fa7a0b6f47ac8b93ddabc3b8dacf076c` — `feat: add API request ID and error contracts`

## Self-review

- Middleware precedes health and registered test routes, so each normal, not-found, and error response receives the request ID header.
- The 404 and 500 bodies contain the required `code`, `message`, `requestId`, and `retryable` fields with the specified values.
- `Variables` keeps `context.get('requestId')` type-safe.
- The commit contains only the two Task 2 API files.

## Concerns

None.
