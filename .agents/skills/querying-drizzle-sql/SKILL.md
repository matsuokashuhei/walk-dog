---
name: querying-drizzle-sql
description: Write Drizzle SQL-like PostgreSQL queries, including select, insert, update, delete, joins, filters, and transactions. Use when building CRUD or join-based queries with the query builder. Do not use for db.query relational finds, schema-only edits, Pool setup, or drizzle-kit migration commands alone.
---

# Querying Drizzle SQL

Read the current official Drizzle PostgreSQL query docs before changing SQL-like query code. Dialect is PostgreSQL only.

## Required documentation review

1. Open <https://orm.drizzle.team/docs/data-querying> and identify the query shape.
2. Read the matching docs before implementing:
   - Select: <https://orm.drizzle.team/docs/select>
   - Insert: <https://orm.drizzle.team/docs/insert>
   - Update: <https://orm.drizzle.team/docs/update>
   - Delete: <https://orm.drizzle.team/docs/delete>
   - Joins: <https://orm.drizzle.team/docs/joins>
   - Filters and operators: <https://orm.drizzle.team/docs/operators>
   - Query helpers: <https://orm.drizzle.team/docs/query-utils>
   - Raw fragments when needed: <https://orm.drizzle.team/docs/sql>
   - Multi-statement writes: <https://orm.drizzle.team/docs/transactions>
3. Record the documentation URLs read and the query decision in the active session log, design, or pull request description.

## Project defaults

- Prefer the SQL-like query builder when the result shape is flat or join-driven.
- Wrap multi-table writes in `db.transaction()` so one business state transition commits together.
- Map database rows to API DTOs; OpenAPI response schemas remain the public contract.
- Use `$querying-drizzle-relations` when the need is nested relational fetches through `db.query`.

## Workflow

| Phase | Provide |
| --- | --- |
| Documentation review | The query capability and official Drizzle docs read. |
| Design | Tables, filters, joins, write set, transaction boundary, and DTO mapping. |
| Implementation | Focused query changes that follow the reviewed documentation. |
| Verification | Typecheck, automated tests for the query path, and an HTTP or unit assertion when exposed by the API. |

## Common decisions

| Request | Read before implementation | Record |
| --- | --- | --- |
| Filtered select | Select and operators | From, where, order, limit |
| Join | Joins and select | Join type, on condition, selected columns |
| Insert / update / delete | Matching mutation docs | Values or set clause, where clause, returning |
| Conditional filters | Operators and data-querying compose examples | Composed `and` / `or` filter list |
| Multi-table write | Transactions | Transaction boundary and failure behavior |

## Completion check

Before reporting a query change complete, provide the documentation reviewed, the queries changed, and the verification results.
