# MEMORY — TACET

**Purpose:** Dense, day-one facts for any new agent or session.
**Last updated:** 2026-09-21
**Read this when:** at the start of every session.

> **Agents: append here whenever you learn something durable** (a gotcha, a working command, a decision that matters). Keep this file under 150 lines. Never write secrets here.

---

## What this is
TACET (formerly SyncIn → SEBBY → Rhiley/TACET) is a Next.js + MongoDB + Neo4j platform. Companies and mentors post problems; students submit; AI (Seashell) ranks; hiring teams see the top. The college pays. Repo folder on the founder's machine: `Sync-in`. Founder: Sharu (solo, student, Bengaluru). Pilot path: HOD → IBM. Focus: tech jobs only.

## Current state (2026-09-21)
- Rebrand to TACET **done and verified**. Fonts migrated, **browser verification still open** (T-03).
- Working: 3 roles (student, hiring_manager, mentor), 5 problem types (open-ended, coding stdin/stdout, coding function-signature [Java], SQL, Mongo), classes, timed tests, stats, logout.
- Missing: HOD dashboard, shortlist flow, student proof pages, demo seed data, real email, more languages. See TASKS.md.
- Agent tooling: Antigravity and Cursor free tiers both hit usage limits. Keep prompts self-contained.

## Intentional legacy (do NOT "fix")
| Leftover | Why |
|---|---|
| Mongo DB name `seeby` | Renaming risks orphaning data |
| `syncin.vercel.app` in metadata | Real deployment URL until a domain exists |
| `syncin@` profile ID prefix | Old accounts must keep working; parse both prefixes |
| `syncin@TEST...` fixtures, `admin@syncin.edu` in `scripts/` | Test/seed data |
| `Sync-in` folder name | Local path, scripts reference it |
| "syncing" in `lib/graphSync.ts` | English verb, not the brand |
| Agent names Seashell / Shellfish / Sand Flea | Deliberate codenames |

## Gotchas already hit
1. **Tailwind v4 ignores `tailwind.config.js`** unless linked with `@config`. Define tokens in `@theme` in `globals.css`. Verify with `getComputedStyle`, not the build.
2. **`melodrame.ttf` is gitignored** (demo license). `next/font/local` fails the build if it's missing. Needs a fallback (T-02).
3. **Instrument Serif has no bold.** Never `font-bold` on it.
4. **Canvas text needs fonts loaded first.** Await `document.fonts.load(...)` before drawing lanyard card and Wrapped export.
5. **PowerShell mangles inline `node -e`** with quotes. Write a script file instead.
6. **Judge0 public CE has rate limits and shared tenancy.** Fine for dev, not for production.
7. **Judge0 has no network.** Grading harnesses must be dependency-free (Java's is a hand-rolled JSON parser).
8. **Java submissions must use `public class Main`.** Flagged in the UI.
9. **Answer keys are `select:false`.** Re-select only in the grading path. An earlier leak of `expectedResult`/`referenceQuery` to any authenticated user was a P0 that has been fixed. Don't regress it.
10. **Duplicate submissions race** unless the unique index exists. `Submission` and `DbSubmission` both have `{problemId, studentId}`.
11. **`collegeId` for users is a string** (e.g. `CAMPUS_DEFAULT`), not an ObjectId. `DbProblem.collegeId` was wrongly ObjectId and caused a 500; now String.
12. **Logout is global.** `loggedOutAt` revokes every session for the account.
13. **Old `sebby_session` cookies are ignored.** Everyone was logged out once at the rename.
14. **A passing build proves little.** Always verify in a browser or with real API calls.
15. **An agent once dumped `.env.local` into its output.** Tell agents never to print env files.
16. **The old `_status-reset-passwords.ts` was removed without being run** (T-05). It would have changed five users' password hashes and marked their emails verified. Login remains unconfirmed because the Mongo SRV lookup times out in Codex.
17. **The reported +1.37M-line diff was caused by untracked local runtime files:** `ranking-service/venv/` and a Tesseract installer. The tracked diff was 6,523 additions / 7,212 deletions. `ranking-service/venv/` must stay gitignored.
18. **Mongo query grading runs on the production Atlas cluster** in ephemeral `tmp_eval_*` collections. Confirm none are left behind.
19. **Auto-promotion of dropped-connection drafts is opportunistic,** not a background job. Runs on the next relevant API call after deadline + 5 min.
20. **Failed Shellfish variants** (`generationFailed: true`) must never be assigned to students.
21. **Codex's sandbox has no outbound DNS for the Mongo SRV lookup.** It cannot verify MongoDB connectivity from this environment.

## Commands that work
```
npm run build && npm run start            # production check
git status --short ; git diff --stat      # before every commit
```
- Verification scripts live in `scripts/` (e.g. `verify-full-features.mjs`, `verify-frontend.ts`). They assert on `tacet_session` and use the legacy DB name.
- Playwright is installed and used for browser passes (script files, not inline).
- Neo4j Desktop must be running at `bolt://127.0.0.1:7687`.
- ranking-service start command: `UNVERIFIED`. Add it here.

## Key identifiers
- Cookie: `tacet_session`. localStorage: `tacet_user`. Both from `lib/constants/auth.ts`.
- Judge0 IDs: Python 71, Java 62, C 50, C++ 54. Fetch real IDs from `/languages` before adding any more.
- Models: `SANDBOX_MONGODB_URI` is the optional isolated grading DB.
- Fonts: `font-display` Melodrame (wordmark + hero only), `font-serif` Instrument Serif, `font-sans` Geist, `font-mono` Geist Mono.
- Brand casing: `TACET` in wordmarks, `Tacet` in prose.
- Design: cream `#FAF7F2`, text `#1A1A1A`, accent `#3F3FF3`. Landing is dark on purpose.

## Known bugs / risks
- `lib/email.ts` sends nothing (stub).
- Community POST route may still trust a body `authorProfileId` (T-21).
- Hiring managers' company name once lived in `collegeName`; partial cleanup only (T-22).
- Tesseract is weak on low-res handwriting; Shellfish openers are repetitive.
- Login response is `{ username, role }`; sidebar/nav may lack college info until reload.

## Where things are documented
PRD.md (what/why) · ARCHITECTURE.md (how) · RULES.md (do/don't) · DESIGN.md (UI) · TASKS.md (work) · DECISIONS.md (why we chose) · FLOW.md (flows + workflow).

## Open questions
- Pricing unit for colleges? What does the HOD need to see on day one?
- Will Melodrame's commercial license cover web embedding?
- Custom domain choice?
