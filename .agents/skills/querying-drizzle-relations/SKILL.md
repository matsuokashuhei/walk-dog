---
name: querying-drizzle-relations
description: Write Drizzle relational queries with db.query, findMany, findFirst, and nested with includes. Use when fetching nested PostgreSQL relations without manual joins. Do not use for SQL-like select/join CRUD, schema-only edits, Pool setup, or drizzle-kit migration commands alone.
---

# Querying Drizzle Relations

Read the current official Drizzle relational query docs before changing `db.query` code. Dialect is PostgreSQL only.

## Required documentation review

1. Open <https://orm.drizzle.team/docs/rqb> before changing relational query code.
2. Read the matching docs before implementing:
   - Relation declarations required by RQB: <https://orm.drizzle.team/docs/relations-schema-declaration>
   - Soft relations when declaring graph edges: <https://orm.drizzle.team/docs/relations>
   - Query overview for choosing RQB vs SQL-like: <https://orm.drizzle.team/docs/data-querying>
3. Confirm the Drizzle client is initialized with the schema modules that export tables and relations.
4. Record the documentation URLs read and the query decision in the active session log, design, or pull request description.

## Project defaults

- Use `db.query` when the result should be nested relational data in one round trip.
- Declare relations in schema modules and pass those modules into `drizzle()` before using `db.query`.
- Map nested query results to API DTOs; OpenAPI response schemas remain the public contract.
- Use `$drizzle:querying-drizzle-sql` when the need is flat CRUD, explicit joins, or set-based updates.

## Workflow

| Phase | Provide |
| --- | --- |
| Documentation review | The relational capability and official Drizzle docs read. |
| Design | Root table, `with` graph, filters, order, limit/offset, and DTO mapping. |
| Implementation | Focused `db.query` changes that follow the reviewed documentation. |
| Verification | Typecheck, automated tests for the nested shape, and an HTTP or unit assertion when exposed by the API. |

## Common decisions

| Request | Read before implementation | Record |
| --- | --- | --- |
| Nested include | RQB include relations | Root query, `with` tree |
| Partial field select | RQB partial fields | Selected columns per relation |
| Relation filters | RQB filters | Where on root and nested relations |
| Pagination or ordering | RQB limit/offset and orderBy | Limit, offset, order expressions |
| Missing `db.query` table | Relations declaration and client schema import | Exported relations and drizzle() schema |

## Completion check

Before reporting a relational query change complete, provide the documentation reviewed, the `db.query` paths changed, and the verification results.
