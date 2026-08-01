---
name: composing-hono-middleware
description: Compose Hono middleware with app.use order, custom middleware, and built-ins such as request-id, body-limit, cors, secure-headers, logger, and bearer-auth. Use when changing middleware stack or cross-cutting request handling. Do not use for route handlers alone, Node.js bootstrap, OpenAPI schema definitions, validation schemas, or tests alone.
---

# Composing Hono Middleware

Read the current official Hono middleware docs before changing the middleware stack. Runtime is Node.js only.

## Required documentation review

1. Open <https://hono.dev/docs/guides/middleware> and identify the middleware change.
2. Read the matching docs before implementing:
   - Middleware concept: <https://hono.dev/docs/concepts/middleware>
   - The specific built-in page being changed under <https://hono.dev/docs/middleware/builtin/>
   - Third-party middleware index when needed: <https://hono.dev/docs/middleware/third-party>
3. Record the documentation URLs read and the middleware decision in the active session log, design, or pull request description.

## Project defaults

- Registration order determines execution order; place shared middleware before route handlers.
- Provide request ID, secure headers, and structured logging on the API.
- Apply JSON body limit of 1 MiB (1,048,576 bytes). Over-limit requests return HTTP 413 with `code: "PAYLOAD_TOO_LARGE"`, `message: "Request body exceeds the allowed size."`, `requestId`, and `retryable: false`.
- Authenticated `/v1` routes validate Cognito access tokens before the handler. `/health` and `/openapi.json` stay public.
- Unauthenticated access to protected routes returns HTTP 401 with `code: "UNAUTHENTICATED"`, `message: "Authentication is required."`, `requestId`, and `retryable: false`.

## Workflow

| Phase | Provide |
| --- | --- |
| Documentation review | The middleware capability and official Hono docs read. |
| Design | Middleware order, path scope, headers, and failure responses. |
| Implementation | Focused middleware changes that follow the reviewed documentation. |
| Verification | Typecheck and request assertions via `$testing-hono-apis`. |

## Common decisions

| Request | Read before implementation | Record |
| --- | --- | --- |
| Add or reorder middleware | Guides middleware and concept | Order, path scope, early-exit behavior |
| Request ID | Built-in request-id | Header name and response echo |
| Body size limit | Built-in body-limit | Limit bytes and 413 error contract |
| CORS or secure headers | Matching built-in docs | Allowed origins/headers and security headers |
| Auth gate for `/v1` | Project API design and bearer-auth or custom middleware docs | Public vs protected paths and 401 contract |

## Completion check

Before reporting a middleware change complete, provide the documentation reviewed, the middleware stack changed, and the verification results.
