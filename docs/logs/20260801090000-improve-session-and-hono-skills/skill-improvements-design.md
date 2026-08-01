# Skill Improvements Design

## Goal

The repository provides a consistent session artifact location and a reusable Hono Node.js API initialization pattern.

## Session Artifact Location

`run-dev-session` defines `docs/logs/<timestamp>-<slug>/` as the session artifact directory. The directory contains the transcript, session checklist, implementation plans, task briefs, implementation reports, review reports, and final verification records.

The transcript artifact list includes every session artifact as it is created. Session publication stages the listed artifacts and the transcript.

## Hono Node.js Initialization

`developing-hono-apis` defines the Node.js API initialization pattern for `apps/api`.

- The API directory runs `npm create hono@latest .` and selects the Node.js template with npm dependencies.
- Development uses `tsx watch`; build produces TypeScript output; start runs the generated Node.js entry point.
- The Hono application factory and Node.js server entry point remain separately testable.
- The first API contract provides health, OpenAPI, request IDs, and JSON error responses.

## Verification

The skill validation uses a session-record scenario and a Node.js API bootstrap scenario. Each scenario records the applicable skill steps before implementation work begins.
