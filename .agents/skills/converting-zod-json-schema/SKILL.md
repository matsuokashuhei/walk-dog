---
name: converting-zod-json-schema
description: Convert between Zod 4 schemas and JSON Schema with toJSONSchema and fromJSONSchema, including target, io, metadata, cycles, and unrepresentable options. Use when generating JSON Schema from Zod or building Zod from JSON Schema. Do not use for schema shape definition alone, parse/safeParse alone, refine/transform alone, error formatting alone, Hono validators alone, or @hono/zod-openapi route document wiring alone.
---

# Converting Zod JSON Schema

Read the current official Zod 4 JSON Schema docs before changing Zod ↔ JSON Schema conversion. Use the classic `zod` package API only.

## Required documentation review

1. Open <https://zod.dev/json-schema> and identify the conversion change.
2. Read the matching docs before implementing:
   - `z.toJSONSchema()` and params: <https://zod.dev/json-schema?id=ztojsonschema>
   - `z.fromJSONSchema()` when ingesting JSON Schema: <https://zod.dev/json-schema?id=zfromjsonschema>
   - Metadata used during conversion: <https://zod.dev/metadata>
3. When the result is the public Hono OpenAPI document, also use `$documenting-hono-openapi` rather than replacing `@hono/zod-openapi`.
4. Record the documentation URLs read and the conversion decision in the active session log, design, or pull request description.

## Project defaults

- Import with `import { z } from 'zod'` (Zod 4 classic API).
- Prefer `@hono/zod-openapi` / `OpenAPIHono` for the served `/openapi.json` contract; use `z.toJSONSchema()` for standalone JSON Schema needs outside that pipeline.
- Treat `z.fromJSONSchema()` as experimental; record that risk when adopting it.
- Set `target` explicitly when consumers require Draft 7, Draft 2020-12, or `openapi-3.0`.
- Use `{ io: "input" }` when the JSON Schema must describe parse input rather than transformed output.
- Resolve unrepresentable types (`z.date()`, transforms, maps, and similar) before conversion, or set `unrepresentable` intentionally.
- Prefer `.meta({ id, title, description })` so converted schemas carry documentation fields.

## Workflow

| Phase | Provide |
| --- | --- |
| Documentation review | The conversion direction and official Zod docs read. |
| Design | Target dialect, io mode, metadata registry, and unrepresentable handling. |
| Implementation | Focused conversion call sites that follow the reviewed documentation. |
| Verification | Typecheck and assertions on the emitted or ingested JSON Schema shape. |

## Common decisions

| Request | Read before implementation | Record |
| --- | --- | --- |
| Zod to JSON Schema | `z.toJSONSchema()` | Target, io, and output destination |
| JSON Schema to Zod | `z.fromJSONSchema()` | Experimental status and source schema |
| OpenAPI 3.0 dialect | target option | `openapi-3.0` vs Draft targets |
| Input vs output schema | io option | Which side consumers validate |
| Cycles or reused defs | cycles and reused params | `$ref` strategy |
| Metadata in output | Metadata and registries | id, title, description |

## Completion check

Before reporting a JSON Schema conversion change complete, provide the documentation reviewed, the conversion sites changed, and the verification results.
