---
name: defining-drizzle-schemas
description: Define and change Drizzle PostgreSQL schemas, including tables, columns, indexes, constraints, enums, and schema-level relations. Use when editing pgTable definitions, column types, indexes, or foreign keys. Do not use for SQL-like CRUD, db.query relational fetches, Pool setup, or drizzle-kit migration commands alone.
---

# Defining Drizzle Schemas

Read the current official Drizzle PostgreSQL schema docs before changing schema source files. Dialect is PostgreSQL only.

## Required documentation review

1. Open <https://orm.drizzle.team/docs/overview> and identify the schema change.
2. Read the matching docs before implementing:
   - Schema layout and table declaration: <https://orm.drizzle.team/docs/sql-schema-declaration>
   - Column types: <https://orm.drizzle.team/docs/column-types>
   - Indexes and constraints: <https://orm.drizzle.team/docs/indexes-constraints>
   - Relations used by relational queries: <https://orm.drizzle.team/docs/relations>
   - PostgreSQL schemas (`pgSchema`) when needed: <https://orm.drizzle.team/docs/schemas>
   - Sequences or views when needed: <https://orm.drizzle.team/docs/sequences>, <https://orm.drizzle.team/docs/views>
3. Record the documentation URLs read and the schema decision in the active session log, design, or pull request description.

## Project defaults

- Export every table, enum, and related model that migrations must see.
- Prefer TypeScript camelCase keys with explicit SQL column names when they differ.
- Keep reusable column groups (for example timestamps) as shared helpers when multiple tables need them.
- After schema edits that change the database shape, use `$migrating-drizzle-postgres` for generate → SQL review → migrate.

## Workflow

| Phase | Provide |
| --- | --- |
| Documentation review | The schema capability and official Drizzle docs read. |
| Design | Tables, columns, nullability, uniqueness, references, and indexes. |
| Implementation | Focused schema file changes that follow the reviewed documentation. |
| Verification | Typecheck and, when the database shape changes, generated SQL review through the migration skill. |

## Common decisions

| Request | Read before implementation | Record |
| --- | --- | --- |
| New table or column | Schema declaration and column types | Table name, column SQL names, nullability, defaults |
| Index or unique constraint | Indexes and constraints | Constraint name, columns, uniqueness |
| Foreign key or self-reference | Schema declaration and relations | Referenced table, on-delete behavior if specified |
| Enum | Schema declaration and column types | Enum name and allowed values |
| Split schema across files | Schema declaration organization | File layout and drizzle-kit schema path |

## Completion check

Before reporting a schema change complete, provide the documentation reviewed, the schema models changed, and the verification results.
