---
name: handling-zod-errors
description: Customize and format Zod 4 validation errors, including schema-level error params, per-parse maps, locales, treeifyError, flattenError, and prettifyError. Use when changing ZodError messages or converting issues for display or API mapping. Do not use for schema shape definition alone, parse call-site choice alone, refine/transform logic alone, JSON Schema conversion alone, Hono validators alone, or OpenAPI route wiring alone.
---

# Handling Zod Errors

Read the current official Zod 4 error customization and formatting docs before changing error messages or issue shaping. Use the classic `zod` package API only.

## Required documentation review

1. Open <https://zod.dev/error-customization> and identify the error-handling change.
2. Read the matching docs before implementing:
   - Schema and per-parse `error` params: <https://zod.dev/error-customization?id=the-error-param>, <https://zod.dev/error-customization?id=per-parse-error-customization>
   - Global config and locales: <https://zod.dev/error-customization?id=global-error-customization>, <https://zod.dev/error-customization?id=internationalization>
   - Precedence rules: <https://zod.dev/error-customization?id=error-precedence>
   - Formatting helpers: <https://zod.dev/error-formatting>
3. Record the documentation URLs read and the error-handling decision in the active session log, design, or pull request description.

## Project defaults

- Import with `import { z } from 'zod'` (Zod 4 classic API).
- Prefer Zod 4 `error` params / error maps over deprecated `message`, `invalid_type_error`, `required_error`, and `errorMap`.
- Prefer `z.treeifyError()`, `z.flattenError()`, and `z.prettifyError()` over deprecated instance helpers such as `.format()` / `.flatten()` on `ZodError`.
- Keep schema-level messages for field-specific contracts; use per-parse maps only when one call site needs different wording.
- Avoid `reportInput: true` unless the issue payload is intentionally allowed to include raw input.
- Map Zod failures at HTTP boundaries into the shared API error JSON through `$validating-hono-requests`; do not invent a second public error shape here.

## Workflow

| Phase | Provide |
| --- | --- |
| Documentation review | The error capability and official Zod docs read. |
| Design | Message ownership (schema / parse / global), locale, and output format. |
| Implementation | Focused error param or formatting changes that follow the reviewed documentation. |
| Verification | Typecheck and assertions that invalid input yields the expected message or formatted structure. |

## Common decisions

| Request | Read before implementation | Record |
| --- | --- | --- |
| Field-level custom message | The error param | Schema site and message text |
| Call-site-only wording | Per-parse error customization | Parse options and precedence |
| Locale or global map | Internationalization and global customization | Locale or `z.config` choice |
| Nested issue tree for UI | `z.treeifyError()` | Target paths and consumers |
| Flat field errors | `z.flattenError()` | `formErrors` / `fieldErrors` mapping |
| Human-readable log string | `z.prettifyError()` | Log or display destination |

## Completion check

Before reporting an error-handling change complete, provide the documentation reviewed, the messages or formatters changed, and the verification results.
