---
name: transforming-zod-schemas
description: Add or change Zod 4 refinements, checks, transforms, pipes, codecs, defaults, and branded types. Use when editing .refine, .check, .transform, .pipe, z.codec, .default, .catch, or .brand. Do not use for base schema shape alone, parse/safeParse call sites alone, error formatting alone, JSON Schema conversion alone, Hono validators alone, or OpenAPI route wiring alone.
---

# Transforming Zod Schemas

Read the current official Zod 4 refinement, transform, and codec docs before changing schema effects. Use the classic `zod` package API only.

## Required documentation review

1. Open <https://zod.dev/api?id=refinements> and identify the transformation change.
2. Read the matching docs before implementing:
   - Refinements and checks: <https://zod.dev/api?id=refine>, <https://zod.dev/api?id=check>
   - Transforms and pipes: <https://zod.dev/api?id=transforms>, <https://zod.dev/api?id=pipes>
   - Defaults, prefaults, and catch: <https://zod.dev/api?id=defaults>, <https://zod.dev/api?id=prefaults>, <https://zod.dev/api?id=catch>
   - Branded types when needed: <https://zod.dev/api?id=branded-types>
   - Bidirectional codecs: <https://zod.dev/codecs>
3. Record the documentation URLs read and the transform decision in the active session log, design, or pull request description.

## Project defaults

- Import with `import { z } from 'zod'` (Zod 4 classic API).
- Prefer `.check()` for Zod 4-native custom validation; keep `.refine()` when an existing schema already uses it.
- Prefer `z.codec()` when encode and decode both matter; prefer `.transform()` for one-way output shaping.
- Remember unidirectional `.transform()` blocks `encode`; do not add encode paths on schemas that contain transforms.
- Prefer `.default()` for missing values at parse time; document coerce helpers such as `z.coerce.number()` when env strings become numbers.
- After adding transforms, update call sites with `$zod:parsing-zod-data` so `z.input` / `z.output` stay accurate.
- HTTP validator wiring stays in `$hono:validating-hono-requests`.

## Workflow

| Phase | Provide |
| --- | --- |
| Documentation review | The transform capability and official Zod docs read. |
| Design | Direction (one-way vs codec), failure messages, and input/output types. |
| Implementation | Focused refine, transform, pipe, codec, or default changes that follow the reviewed documentation. |
| Verification | Typecheck and assertions for both accepted and rejected inputs; encode paths when codecs are used. |

## Common decisions

| Request | Read before implementation | Record |
| --- | --- | --- |
| Cross-field or custom rule | Refinements and checks | Rule, path, and error message |
| One-way value rewrite | Transforms | Input type, output type, async need |
| Bidirectional encode/decode | Codecs | Input schema, output schema, decode/encode |
| Missing-value fallback | Defaults and catch | Default or catch value and direction limits |
| Nominal typing | Branded types | Brand name and usage sites |
| String-to-number env coerce | Coercion plus defaults | Coerce helper and default |

## Completion check

Before reporting a transform change complete, provide the documentation reviewed, the schema effects changed, and the verification results.
