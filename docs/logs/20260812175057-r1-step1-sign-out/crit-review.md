# Crit review — 20260812175057-r1-step1-sign-out

- status: **CHANGES_REQUESTED**
- reviewer: session Crit (artifacts only; `transcript.md` excluded)
- criteria: `AGENTS.md` 文書規則、セッション目的の製品契約、design / plan / spec / e2e の一致、計画タスク網羅、`staged-development.md` の Sign Out 同期

## Summary of contract check

| Contract point | Result |
| --- | --- |
| Body has no `discardActiveWalk`; successful Sign Out fails Active Walk when present | Agreed across spec, design, plan, mockups, specification-review |
| Settings = Sign Out + legal links on `/settings` | Agreed in session artifacts; screenshot SETTINGS-01 matches |
| Active Walk confirm → always Failed; cancel keeps walk/session | Agreed in spec, design, plan, staged-development Sign Out bullet |
| `POST /v1/auth/sign-out` → Access Token, `204`, Failed when present | Agreed; staged-development public interface bullet synced |
| Plan Tasks cover design | Tasks 1–6 map gate → ports → use case/route → composition/OpenAPI → mobile Settings → iOS evidence |
| e2e evidence | Idle Settings and post–Sign Out Sign In match claimed SETTINGS-01 / AUTH-01 for the no–Active Walk path |

## Critical

None.

## Important

1. **`sign-out-specification.md` WHAT uses out-of-scope and absence framing (AGENTS.md)**  
   - Path: `docs/logs/20260812175057-r1-step1-sign-out/sign-out-specification.md`  
   - Lines stating Preferences / Email Change are out of scope, and that the request “does not have” `discardActiveWalk`, violate `AGENTS.md`（スコープ外を説明しない／禁止・不在ではなく肯定形で制約を書く）.  
   - The affirmative contract is already present (Settings provides Sign Out + legal; body is `{}` or absent; server always Failed when Active Walk exists). Rewrite WHAT to keep only those affirmative statements.  
   - Same absence / out-of-scope phrasing is echoed in `design.md` acceptance and `plan.md` Global Constraints; align those after the spec fix.

2. **Plan-level Settings ownership is confirmed but not synced into `staged-development.md`**  
   - Paths: `docs/logs/20260812175057-r1-step1-sign-out/specification-review.md` (Decisions: `/settings` with Sign Out and legal links; Preferences / Email Change remain R3); `docs/development/staged-development.md`  
   - Sign Out behavior and `POST /v1/auth/sign-out` bullets are synced and match the session contract.  
   - The confirmed plan-level Settings entry (`/settings` = Sign Out + legal) is not recorded under R1. R3 still lists 利用規約 / プライバシーポリシー / アプリ情報 without distinguishing R1 Settings hosting of those links. Sync the Settings ownership (or adjust R3 wording) so release boundaries match the confirmed decision.

## Minor

1. **`specification-review.md` deliverable wording is ambiguous**  
   - Path: `docs/logs/20260812175057-r1-step1-sign-out/specification-review.md`  
   - “optional Active Walk Failed” can be read as optional Failed behavior. Decisions correctly say always Failed when present. Prefer “fail Active Walk when present” or equivalent affirmative phrasing.

2. **AUTH-01 screenshot includes a control not in the mockup**  
   - Paths: `screenshots/ios-sign-out-sign-in.png`, `sign-out-spec-mockups.html` (AUTH-01)  
   - Evidence matches Sign In after Sign Out (Welcome back / Email / Continue / Create account / legal). A floating gear control appears on the captured Sign In screen and is not in AUTH-01 mockup. Note or reconcile if it is intentional chrome vs residual entry.

3. **`plan.md` task checkboxes remain unchecked**  
   - Path: `docs/logs/20260812175057-r1-step1-sign-out/plan.md`  
   - Implementation and e2e evidence show Tasks 1–6 were executed; checkbox state is stale documentation only.

## e2e evidence note

- `e2e-report.md` and screenshots support Settings idle (legal links + Sign Out only) and Sign Out → Sign In after `204`.  
- Active Walk confirm path is intentionally deferred (design / plan); no contradiction for this slice.

## Required before APPROVED

1. Rewrite product-spec WHAT (and mirrored design/plan constraint lines) to affirmative form only.  
2. Sync confirmed `/settings` Sign Out + legal ownership into `docs/development/staged-development.md` (and clarify R3 legal / Settings boundary if needed).


## Response

- Important 1: Rewrote `sign-out-specification.md`, `design.md`, and `plan.md` Global Constraints in affirmative form (Settings provides Sign Out + legal; body allows `{}` or omission; Active Walk Failed on confirmed Sign Out).
- Important 2: Synced R1 Settings ownership into `staged-development.md` and clarified R3 adds Preferences / Email Change to the existing Settings legal entry.
- Minor 1: specification-review deliverable now says fail Active Walk when present.
- Minor 2: Sign In gear control is Expo/dev chrome; left as residual note (not product chrome).
- Minor 3: plan task checkboxes marked complete.
