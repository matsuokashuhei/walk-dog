# Hono and Drizzle Standard Method Confirmation Design

## Goal

Existing Hono and Drizzle coding skills confirm official documentation, project defaults, implementation decisions, and verification results before reporting work complete. They additionally confirm the standard method, command, or API before implementation begins.

## Context

The previous R0 PostgreSQL session first implemented a custom migration runner and later changed to the standard Drizzle Kit migration command after review. Existing skills require official documentation review, but they do not consistently require an explicit comparison of supported methods and a recorded standard-method selection before implementation.

## Scope

The change updates the existing coding skills for:

- Hono: Node.js bootstrap, middleware, OpenAPI, routing, request validation, and API testing.
- Drizzle: PostgreSQL connection, schema definition, migrations, relational queries, and SQL-like queries.

The change preserves each skill's existing official URLs, project defaults, responsibilities, and completion checks. It changes guidance documents only.

## Design

### Standard method confirmation

Each skill adds a `Standard method confirmation` section immediately after its required documentation review.

Before changing source files, the agent:

1. Reads the official documentation relevant to the requested capability.
2. Identifies the supported methods, commands, APIs, or integration patterns.
3. Checks the project default against the official documentation.
4. Selects the method that fits the requested capability and records the selection and reason.
5. Records the official URLs and the command or API that will be used.
6. Requests clarification and pauses design or implementation when official information is missing, conflicting, or insufficient to establish the standard method.

The skill's `Workflow` states that this confirmation and record precede design and implementation.

### Hono records

The selected record identifies the runtime or adapter, Hono API or middleware, package command when applicable, official documentation URLs, project default, and reason. The record is specific to the skill capability, such as Node adapter startup, middleware order, OpenAPI integration, route composition, validator choice, or `app.request` testing.

### Drizzle records

The selected record identifies the driver or query mode, Drizzle API or Kit command, schema or migration source, official documentation URLs, project default, and reason. Migration records explicitly state the generate → SQL review → migrate sequence and the selected Kit command. Query records distinguish relational queries from SQL-like queries by the required result shape.

### Confirmation states

- `ready`: official sources support the selected project method and the decision record is complete.
- `awaiting-confirmation`: the official sources support multiple applicable methods and the project choice needs user approval.
- `blocked`: the official source is missing, conflicting, or insufficient to establish a standard method.

The agent does not begin implementation in `awaiting-confirmation` or `blocked`.

## Verification

- Baseline Hono scenario: select a middleware, validator, or testing approach without explicitly comparing official alternatives or recording the selected method.
- Baseline Drizzle scenario: introduce a custom migration runner even though the official Drizzle Kit generate and migrate flow is available.
- Updated scenarios: cite official sources, identify supported alternatives, select the project-standard method, record the command or API and reason, and pause when the standard cannot be established.
- Run `quick_validate.py` for all 11 modified skills.
- Run the existing API test suite and TypeScript build.

## Acceptance conditions

- All 11 skills contain the same standard-method confirmation contract.
- Each skill preserves its technology-specific documentation URLs and project defaults.
- Every updated workflow records the selected method before implementation.
- Missing or conflicting official guidance produces a confirmation state that prevents implementation.
- Existing API tests, TypeScript build, skill validators, and Crit review pass.
