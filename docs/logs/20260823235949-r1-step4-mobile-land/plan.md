# TrackPoint mobile land — implementation plan

> For agentic workers: execute task-by-task with TDD. Checkboxes track progress.

**Goal:** Put R1 slice 4 TrackPoint mobile (10s sample, durable queue, recording path) onto current main without dropping location-settings guidance or auth-expiry Sign In.

**Architecture:** Keep current Walk screen, auth, and location-permission modules. Add TrackPoint schema, POST, file-backed queue, location task, and recording path overlay. Finish flushes the device queue then POSTs finish. DynamoDB confirmation stays in slice 5.

**Tech Stack:** Expo SDK 57, expo-location, expo-maps, expo-file-system, expo-task-manager, zod.

**Spec:** `docs/logs/20260823235949-r1-step4-mobile-land/specification-review.md`

## Tasks

- [x] 1. Schema + `postTrackPoint` tests and implementation
- [x] 2. Queue coordinator tests and implementation
- [x] 3. File storage + location task wiring; add `expo-file-system` and `expo-task-manager`
- [x] 4. Merge Walk screen: path, sample, flush-before-finish; keep settings CTA
- [x] 5. Root layout stops sampling when signed out
- [x] 6. Verify mobile tests and `tsc --noEmit`
