---
name: parsing-zod-data
description: Parse and type-infer Zod 4 data with parse, safeParse, async variants, z.infer, z.input, and z.output. Use when validating runtime values against an existing schema or extracting TypeScript types from schemas. Do not use for schema shape definition alone, refine/transform/codec alone, error message customization alone, JSON Schema conversion alone, Hono validators alone, or OpenAPI route wiring alone.
---

# Parsing Zod Data

Read the current official Zod 4 basic usage docs before changing parse or type-inference call sites. Use the classic `zod` package API only.

## Required documentation review

1. Open <https://zod.dev/basics> and identify the parse or inference change.
2. Read the matching sections before implementing:
   - Parsing data: <https://zod.dev/basics?id=parsing-data>
   - Handling thrown `ZodError` vs result objects: <https://zod.dev/basics?id=handling-errors>
   - Inferring types: <https://zod.dev/basics?id=inferring-types>
3. When failure messages or formatted issues are part of the change, also use `$zod:handling-zod-errors`.
4. Record the documentation URLs read and the parsing decision in the active session log, design, or pull request description.

## Project defaults

- Import with `import { z } from 'zod'` (Zod 4 classic API).
- Use `.parse()` when invalid input must stop startup or a trusted boundary (for example env config loaders).
- Use `.safeParse()` when callers map failure into application error responses or branching logic.
- Use `.parseAsync()` / `.safeParseAsync()` when the schema includes async refinements or transforms.
- Prefer `z.infer<typeof schema>` for output types; use `z.input` / `z.output` when transforms make input and output diverge.
- HTTP request validation remains in `$hono:validating-hono-requests`; do not reimplement Hono validators here.

## Workflow

| Phase | Provide |
| --- | --- |
| Documentation review | The parse or inference capability and official Zod docs read. |
| Design | Parse API choice, failure path, and inferred TypeScript types. |
| Implementation | Focused parse or type extraction changes that follow the reviewed documentation. |
| Verification | Typecheck and valid/invalid input assertions for the changed call site. |

## Common decisions

| Request | Read before implementation | Record |
| --- | --- | --- |
| Throw on invalid input | Parsing data | `.parse()` call site and ownership of thrown `ZodError` |
| Branch on success/failure | Handling errors | `.safeParse()` result handling |
| Async schema | Parsing data async notes | `.parseAsync()` or `.safeParseAsync()` |
| Shared TypeScript type | Inferring types | `z.infer`, `z.input`, or `z.output` |
| Env or config load | Basics plus project config patterns | Schema owner and fail-fast behavior |

## Completion check

Before reporting a parsing change complete, provide the documentation reviewed, the parse or inference sites changed, and the verification results.
