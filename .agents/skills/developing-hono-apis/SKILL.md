---
name: developing-hono-apis
description: Use when creating, changing, debugging, testing, or configuring a Hono HTTP API, including Hono route, middleware, OpenAPI, runtime adapter, development command, or deployment work.
---

# Developing Hono APIs

Read the current official Hono documentation before making an API change. Use the documentation that matches the target runtime and the change being made.

## Required documentation review

1. Open <https://github.com/honojs/website/tree/main/docs> before inspecting or changing API source files.
2. Identify the target runtime and the requested API capability.
3. Read the relevant files in the Hono Docs tree before choosing an implementation:
   - Read the `getting-started` directory and the target runtime guide for a new API, runtime adapter, development command, build, or server startup change.
   - Read the `api` directory for routes, request and response handling, context, or error handling.
   - Read the `middleware` directory for middleware, authentication, CORS, body limits, or headers.
   - Read the `guides` directory for OpenAPI, validation, testing, or deployment capabilities.
4. Record the documentation URLs or repository paths read and the resulting implementation decision in the active session log, design, or pull request description.

## Node.js initialization

After the required official Hono Docs review, initialize the first Node.js API in `apps/api` with this recipe before writing source files:

1. Run `cd apps/api`.
2. Run `npm create hono@latest .`.
3. Select the Node.js template and npm for dependency installation.
4. Define the package scripts:
   - `dev`: `tsx watch src/index.ts`
   - `build`: TypeScript compilation that writes production output to `dist`
   - `start`: `node dist/index.js`
5. Keep `src/app.ts` as an application factory that creates the Hono application. Keep `src/index.ts` as the Node.js startup entry point that serves the factory result. Tests import the factory without starting a Node.js listener.
6. Define the first public contract before implementation: `GET /health`, `GET /openapi.json`, a request ID returned with each response, and JSON error responses containing the documented status, message, request ID, and retry operation.
7. Add contract tests for the health response, OpenAPI document, request ID, and JSON error response before extending the API.

Record the selected template, package scripts, application boundary, public contract, and official Hono Docs read in the active session log, design, or pull request description.

## Workflow

| Phase | Provide |
| --- | --- |
| Documentation review | The runtime, capability, and official Hono Docs read. |
| Design | The route contract, status and error responses, middleware order, and runtime entry point. |
| Implementation | Focused route and middleware changes that follow the reviewed documentation. |
| Verification | Automated tests, type checks, and an HTTP request against each changed endpoint. |

Use the project’s API contract as the source of request and response schemas. Return the documented error state with its status, message, and retry operation when a request cannot complete. Keep runtime startup and the Hono application separately testable.

## Common decisions

| Request | Read before implementation | Record |
| --- | --- | --- |
| New Node.js API | Getting-started and Node.js runtime documentation | Adapter, development command, build command, production entry point |
| Route or API response | API routes and request/response documentation | Method, path, schemas, statuses, error response |
| OpenAPI endpoint | OpenAPI and validation guides | Schema owner and generated document endpoint |
| Middleware | Middleware documentation for the selected capability | Order, scope, headers, and failure response |
| Test failure or behavior change | Documentation for the affected Hono capability | Reproduced request, expected response, and verification command |

## Completion check

Before reporting an API change complete, provide the documentation reviewed, the public API contract changed, and the verification results.
