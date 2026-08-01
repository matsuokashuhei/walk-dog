---
name: testing-hono-apis
description: Test Hono APIs with app.request and the testing helper, including contract tests for health, OpenAPI, request ID, and error responses. Use when adding or fixing API tests without starting a Node.js listener. Do not use for Node.js bootstrap, route design alone, middleware design alone, or OpenAPI authoring alone.
---

# Testing Hono APIs

Read the current official Hono testing docs before changing API tests. Runtime is Node.js only.

## Required documentation review

1. Open <https://hono.dev/docs/guides/testing> before writing or changing tests.
2. Read <https://hono.dev/docs/helpers/testing> when using the typed testing helper.
3. Record the documentation URLs read and the test decision in the active session log, design, or pull request description.

## Project defaults

- Import the application factory and call `app.request` without starting a Node.js listener.
- Cover the public contract: `GET /health`, `GET /openapi.json`, request ID behavior, and shared JSON error responses.
- For JSON body tests, set `Content-Type: application/json` when validators expect it.
- Assert status, payload fields (`code`, `message`, `requestId`, `retryable` when relevant), and required headers.

## Workflow

| Phase | Provide |
| --- | --- |
| Documentation review | The testing approach and official Hono docs read. |
| Design | Requests, expected statuses, payloads, and headers under test. |
| Implementation | Focused tests against the factory app that follow the reviewed documentation. |
| Verification | The test command results for the changed cases. |

## Common decisions

| Request | Read before implementation | Record |
| --- | --- | --- |
| New contract test | Testing guide | Request, expected status and body |
| Typed test client | Testing helper | Helper usage and assertions |
| Validation failure case | Testing guide and validation docs | Invalid payload and error contract |
| OpenAPI document assertion | Testing guide and OpenAPI skill | Paths, schemas, or security present in `/openapi.json` |
| Authenticated route case | Testing guide and project auth contract | Token setup and 401/200 expectations |

## Completion check

Before reporting a testing change complete, provide the documentation reviewed, the tests changed, and the verification command results.
