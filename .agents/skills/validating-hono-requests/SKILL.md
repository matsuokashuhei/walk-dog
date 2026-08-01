---
name: validating-hono-requests
description: Validate Hono request input with hono/validator, Zod, or @hono/zod-validator, including validator error handling. Use when changing request validation for json, query, param, header, cookie, or form. Do not use for OpenAPI document generation alone, route structure alone, middleware stacks alone, Node.js bootstrap, or tests alone.
---

# Validating Hono Requests

Read the current official Hono validation docs before changing request validators. Runtime is Node.js only.

## Required documentation review

1. Open <https://hono.dev/docs/guides/validation> and identify the validation target.
2. Read <https://hono.dev/examples/validator-error-handling> when shaping validator failure responses.
3. When the validated fields are part of the public API contract, also use `$documenting-hono-openapi`.
4. Record the documentation URLs read and the validation decision in the active session log, design, or pull request description.

## Project defaults

- OpenAPI / Zod schemas are the source of request validation for public endpoints.
- Prefer `@hono/zod-openapi` route definitions when the endpoint is documented; use `@hono/zod-validator` or `hono/validator` only when that path is intentional.
- Validation failures return the shared error JSON with HTTP status, `code`, `message`, `requestId`, and `retryable`.
- JSON and form validators require a matching `Content-Type` header.

## Workflow

| Phase | Provide |
| --- | --- |
| Documentation review | The validation target and official Hono docs read. |
| Design | Target (`json` / `query` / `param` / etc.), schema, and failure response. |
| Implementation | Focused validator changes that follow the reviewed documentation. |
| Verification | Typecheck and invalid/valid request assertions via `$testing-hono-apis`. |

## Common decisions

| Request | Read before implementation | Record |
| --- | --- | --- |
| JSON body validation | Validation guide | Schema fields and Content-Type requirement |
| Query or path validation | Validation guide | Target key and schema |
| Zod validator middleware | Validation guide Zod sections | Package choice and schema reuse |
| Custom validation error body | Validator error-handling example | Status, code, message, retryable |
| Documented public input | OpenAPI skill | Schema owner in OpenAPI document |

## Completion check

Before reporting a validation change complete, provide the documentation reviewed, the validators changed, and the verification results.
