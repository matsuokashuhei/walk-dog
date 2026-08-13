# Crit review — 20260812175057-r1-step1-sign-out

- status: **APPROVED**
- reviewer: session Crit (artifacts only; `transcript.md` excluded)
- round: re-review after Important fixes
- criteria: `AGENTS.md` 文書規則、セッション目的の製品契約、design / plan / spec / e2e の一致、計画タスク網羅、`staged-development.md` の Sign Out 同期

## Summary of contract check

| Contract point | Result |
| --- | --- |
| Body allows `{}` or omission; successful Sign Out fails Active Walk when present | Agreed across spec, design, plan, mockups, specification-review |
| Settings = Sign Out + legal links on `/settings` | Agreed in session artifacts and `staged-development.md` R1; screenshot SETTINGS-01 matches |
| Active Walk confirm → always Failed; cancel keeps walk/session | Agreed in spec, design, plan, staged-development Sign Out bullet |
| `POST /v1/auth/sign-out` → Access Token, `204`, Failed when present | Agreed; staged-development public interface bullet synced |
| Plan Tasks cover design | Tasks 1–6 map gate → ports → use case/route → composition/OpenAPI → mobile Settings → iOS evidence; checkboxes complete |
| e2e evidence | Idle Settings and post–Sign Out Sign In match claimed SETTINGS-01 / AUTH-01 for the no–Active Walk path |

## Prior Important — resolved

1. **Affirmative AGENTS wording** — Resolved.  
   `sign-out-specification.md` WHAT, `design.md` acceptance, and `plan.md` Global Constraints state Settings provides Sign Out + legal; body allows `{}` or omission; Active Walk Failed on confirmed Sign Out. Out-of-scope / absence framing removed from those product-contract lines.

2. **Settings ownership in `staged-development.md`** — Resolved.  
   R1 records `/settings` = Sign Out + legal links. R3 states legal links continue from R1 and Preferences / Email Change are added to Settings.

## Critical

None.

## Important

None.

## Minor (residual, non-blocking)

1. **`sign-out-spec-mockups.html` note still uses absence framing**  
   - Path: `docs/logs/20260812175057-r1-step1-sign-out/sign-out-spec-mockups.html`  
   - Note says body に discard フラグは持たない. Contract elsewhere is affirmative (`{}` or omission). Cosmetic only.

2. **AUTH-01 screenshot includes Expo/dev gear chrome**  
   - Paths: `screenshots/ios-sign-out-sign-in.png`, `sign-out-spec-mockups.html` (AUTH-01)  
   - Evidence still matches Sign In after Sign Out. Floating gear is residual Expo/dev chrome, not product Settings.

3. **`plan.md` Self-review still says `no discardActiveWalk`**  
   - Path: `docs/logs/20260812175057-r1-step1-sign-out/plan.md`  
   - Self-review checklist uses absence phrasing; Global Constraints are affirmative. Non-blocking.

## e2e evidence note

- `e2e-report.md` and screenshots support Settings idle (legal links + Sign Out only) and Sign Out → Sign In after `204`.  
- Active Walk confirm path is intentionally deferred (design / plan); no contradiction for this slice.

## Response (prior round)

- Important 1: Rewrote `sign-out-specification.md`, `design.md`, and `plan.md` Global Constraints in affirmative form.
- Important 2: Synced R1 Settings ownership into `staged-development.md` and clarified R3 adds Preferences / Email Change to the existing Settings legal entry.
- Minor 1: specification-review deliverable now says fail Active Walk when present.
- Minor 2: Sign In gear control is Expo/dev chrome; left as residual note.
- Minor 3: plan task checkboxes marked complete.


## Re-crit

- status: APPROVED
- Important 1 and Important 2 resolved; no remaining Critical/Important findings.
