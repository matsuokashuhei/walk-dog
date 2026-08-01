---
name: documenting-hono-openapi
description: Define and change Hono OpenAPI contracts with @hono/zod-openapi, OpenAPIHono, route schemas, /openapi.json, and BearerAuth security schemes. Use when editing OpenAPI documents or documented route schemas. Do not use for Node.js bootstrap, middleware-only changes, undocumented validators alone, or tests alone.
---

# Documenting Hono OpenAPI

Read the current official Hono OpenAPI examples before changing OpenAPI schemas or the document endpoint. Runtime is Node.js only. OpenAPI lives in Hono examples and third-party packages, not the core API docs alone.

## Required documentation review

1. Open <https://hono.dev/examples/zod-openapi> before changing `@hono/zod-openapi` usage.
2. Read the OpenAPI section of <https://hono.dev/docs/middleware/third-party>.
3. Read <https://hono.dev/examples/swagger-ui> or <https://hono.dev/examples/scalar> only when adding an API reference UI.
4. Record the documentation URLs read and the OpenAPI decision in the active session log, design, or pull request description.

## Project defaults

- Use `@hono/zod-openapi` / `OpenAPIHono` as the API contract source.
- Serve the document at `GET /openapi.json`.
- OpenAPI schemas drive request validation, response validation, and mobile typed client generation.
- Define shared Zod component schemas with `$defining-zod-schemas`; use `$converting-zod-json-schema` only for standalone JSON Schema conversion outside this OpenAPI pipeline.
- Define `components.securitySchemes.BearerAuth` as HTTP bearer JWT. Protected routes use `security: [{ BearerAuth: [] }]`. `/health` and `/openapi.json` stay public.
- Shared error responses use the documented error schema with `code`, `message`, `requestId`, and `retryable`.
- Pair input schema changes with `$validating-hono-requests` behavior and verify with `$testing-hono-apis`.

## Workflow

| Phase | Provide |
| --- | --- |
| Documentation review | The OpenAPI capability and official Hono examples read. |
| Design | Paths, schemas, statuses, security requirements, and document endpoint. |
| Implementation | Focused OpenAPIHono and schema changes that follow the reviewed documentation. |
| Verification | Typecheck and assertions that `/openapi.json` describes the changed contract. |

## Common decisions

| Request | Read before implementation | Record |
| --- | --- | --- |
| New documented route | Zod OpenAPI example | Path, method, request/response schemas, security |
| Shared component schema | Zod OpenAPI example | Schema name and fields; define shape with `$defining-zod-schemas` when needed |
| OpenAPI document endpoint | Zod OpenAPI example | Path and OpenAPI version |
| Bearer security scheme | Project API design and Zod OpenAPI example | Scheme id and protected routes |
| API reference UI | Swagger UI or Scalar example | UI path and document URL |
| Standalone JSON Schema export | `$converting-zod-json-schema` | Conversion target outside `/openapi.json` |

## Completion check

Before reporting an OpenAPI change complete, provide the documentation reviewed, the schemas or document endpoint changed, and the verification results.
