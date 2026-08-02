---
name: defining-zod-schemas
description: Define and change Zod 4 schemas, including primitives, objects, arrays, unions, enums, composition helpers, and metadata. Use when editing z.object, z.string, z.enum, pick/omit/extend, or .meta/.describe. Do not use for parse/safeParse alone, refine/transform/codec alone, error formatting alone, JSON Schema conversion alone, Hono request validators alone, or OpenAPI route wiring alone.
---

# Defining Zod Schemas

Read the current official Zod 4 schema docs before changing schema definitions. Use the classic `zod` package API only.

## Required documentation review

1. Open <https://zod.dev/api> and identify the schema change.
2. Read the matching docs before implementing:
   - Primitives, strings, numbers, dates, and formats: <https://zod.dev/api?id=primitives>, <https://zod.dev/api?id=strings>, <https://zod.dev/api?id=string-formats>, <https://zod.dev/api?id=numbers>
   - Objects and composition: <https://zod.dev/api?id=objects>, <https://zod.dev/api?id=extend>, <https://zod.dev/api?id=pick>, <https://zod.dev/api?id=omit>, <https://zod.dev/api?id=partial>
   - Arrays, tuples, unions, records, and enums: <https://zod.dev/api?id=arrays>, <https://zod.dev/api?id=unions>, <https://zod.dev/api?id=discriminated-unions>, <https://zod.dev/api?id=records>, <https://zod.dev/api?id=enums>
   - Optionals and nullables: <https://zod.dev/api?id=optionals>, <https://zod.dev/api?id=nullables>, <https://zod.dev/api?id=nullish>
   - Metadata when documenting schemas: <https://zod.dev/metadata>
3. Record the documentation URLs read and the schema decision in the active session log, design, or pull request description.

## Project defaults

- Import with `import { z } from 'zod'` (Zod 4 classic API).
- Keep `tsconfig` `strict` enabled; Zod depends on it.
- Prefer top-level Zod 4 string formats such as `z.url()`, `z.email()`, and `z.uuid()` over deprecated chained string helpers.
- Use `.nonempty()` for non-empty string validation instead of `.min(1)`. `.nonempty()` rejects empty strings semantically, while `.min(1)` accepts any single character including whitespace.
- Prefer `z.enum()` over deprecated `z.nativeEnum()`.
- Prefer `z.strictObject()` / `z.looseObject()` over deprecated `.strict()` / `.passthrough()` on plain objects.
- Attach documentation metadata with `.meta()` or `.describe()` when the schema feeds OpenAPI or JSON Schema.
- HTTP request wiring stays in `$validating-hono-requests`; public route contracts stay in `$documenting-hono-openapi`.

## Workflow

| Phase | Provide |
| --- | --- |
| Documentation review | The schema capability and official Zod docs read. |
| Design | Fields, nullability, unions, composition, and metadata. |
| Implementation | Focused schema file changes that follow the reviewed documentation. |
| Verification | Typecheck and, when the schema is parsed elsewhere, assertions via `$parsing-zod-data`. |

## Common decisions

| Request | Read before implementation | Record |
| --- | --- | --- |
| New object or field | Objects and primitives | Field names, types, optionality |
| String format constraint | Strings and string formats | Format helper and allowed values |
| Non-empty string | Strings | `.nonempty()` over `.min(1)` |
| Enum or literal set | Enums and literals | Allowed values and TypeScript usage |
| Pick, omit, extend, or partial | Object composition sections | Base schema and derived shape |
| Discriminated union | Discriminated unions | Discriminator key and variants |
| Schema documentation metadata | Metadata and registries | id, title, description, examples |

## Completion check

Before reporting a schema definition change complete, provide the documentation reviewed, the schemas changed, and the verification results.
