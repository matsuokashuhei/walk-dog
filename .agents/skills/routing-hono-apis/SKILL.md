---
name: routing-hono-apis
description: Define and change Hono routes, app.route composition, Context and HonoRequest usage, and HTTPException handling. Use when adding or editing HTTP handlers and path structure. Do not use for Node.js bootstrap, middleware-only changes, validation schemas, OpenAPI document wiring, or tests alone.
---

# Routing Hono APIs

Read the current official Hono routing and API docs before changing route handlers or path composition. Runtime is Node.js only.

## Required documentation review

1. Open <https://hono.dev/docs/api/hono> and identify the routing change.
2. Read the matching docs before implementing:
   - Routing: <https://hono.dev/docs/api/routing>
   - Context: <https://hono.dev/docs/api/context>
   - HonoRequest: <https://hono.dev/docs/api/request>
   - HTTPException: <https://hono.dev/docs/api/exception>
   - Larger apps and handler placement: <https://hono.dev/docs/guides/best-practices>
3. Record the documentation URLs read and the routing decision in the active session log, design, or pull request description.

## Project defaults

- Register resource route modules under `/v1` with `app.route`.
- Prefer handlers declared with the path so path params stay typed; avoid Ruby-on-Rails-like controllers.
- Return documented success JSON or the shared error JSON (`code`, `message`, `requestId`, `retryable`).
- OpenAPI remains the public contract owner (`$documenting-hono-openapi`). Input checks use `$validating-hono-requests` when needed.

## Workflow

| Phase | Provide |
| --- | --- |
| Documentation review | The routing capability and official Hono docs read. |
| Design | Method, path, statuses, success and error responses, and module placement under `/v1`. |
| Implementation | Focused route module changes that follow the reviewed documentation. |
| Verification | Typecheck and request assertions via `$testing-hono-apis`. |

## Common decisions

| Request | Read before implementation | Record |
| --- | --- | --- |
| New resource route | Routing, Context, best practices | Method, path, module file, statuses |
| Path or query params | Routing and HonoRequest | Param names and typed access |
| Split route modules | Best practices `app.route` | Mount path and exported app |
| Fatal handler error | HTTPException | Status, message, handling site |
| Response shape change | Project API contract and OpenAPI skill | DTO fields and error fields |

## Completion check

Before reporting a routing change complete, provide the documentation reviewed, the routes changed, and the verification results.
