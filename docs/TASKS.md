# TASKS — TACET

**Purpose:** The work board: what is done, what is next, what is blocked.
**Last updated:** 2026-09-21
**Read this when:** choosing what to build, briefing an agent, or updating status after a task.

Effort: **S** = under half a day, **M** = 1–2 days, **L** = 3+ days. Update status here at the end of every task.

---

## Now (this week)

### T-01 Verify these docs against the real repo (S)
**Goal:** Replace every `UNVERIFIED` marker in `/docs` with facts from the code.
**Acceptance:** Full API route list, all models and fields, actual collection names, env var names, real file paths, Next.js version. Nothing invented. Remaining unknowns listed in one place.

### T-02 Make the build safe without the Melodrame font (S)
**Goal:** Fresh clone or Vercel build doesn't crash when `public/fonts/melodrame.ttf` is missing (it is gitignored).
**Acceptance:** Helper checks `fs.existsSync` at build time and falls back to Instrument Serif for `--font-display`. Build passes with and without the file.

### T-03 Verify fonts really render (S)
**Goal:** Prove the font migration works in a browser.
**Acceptance:** `getComputedStyle().fontFamily` table for hero, wordmark, headings, body and mono; Tailwind v4 `@theme` mapping confirmed (remove dead `tailwind.config.js` if ignored); Melodrame glyph coverage printed for `T A C E T`, the hero line, digits and punctuation; canvas `ctx.font` strings updated and awaited via `document.fonts.load`; no Times/Arial fallback in screenshots.

### T-06 Rotate exposed credentials if the databases are reachable outside localhost (S)
**Goal:** Neo4j password and Mongo URI appeared in agent output.
**Acceptance:** Atlas DB user password rotated; Neo4j password changed; `.env.local` updated locally; nothing committed.

## Next (in this order)

### T-07 More Judge0 languages (S–M)
**Goal:** Add JavaScript (Node), TypeScript, Go, Rust, Kotlin, C# to stdin/stdout grading.
**Acceptance:** Real IDs from `GET /languages`; templates, CodeMirror modes and server allowlists updated (grep every place); each language tested with pass, wrong answer, compile error and infinite loop; Shellfish reference-solution generation verified in at least JS and Go. Skip any language the instance lacks.

### T-08 Demo mode with seeded data (M)
**Goal:** A fresh login looks alive in 10 seconds.
**Acceptance:** About 8 realistic problems across all formats, 20–30 fake students, ranked submissions, 1 company, 1 mentor with a class. Idempotent seed script that only touches records tagged as demo. One command to reset. Never runs against production data by accident.
**Current dependency:** Company problems support optional multi-college targeting through `collegeIds`; empty/missing targets remain visible to all colleges for backward compatibility.

**Current implementation note:** DbProblem creators can upload one CSV table for SQL or one JSON document array for Mongo; the form infers editable types, previews the first 10 rows, and stores the existing `schemaDefinition` string. Students have a scoped Run preview beside the graded Submit action.

### T-09 Real empty states everywhere (S)
**Goal:** Every blank panel tells the user what to do next.
**Acceptance:** Every panel in DESIGN.md §7 done; no raw zeros or blank boxes on a fresh account.

### T-10 Ranking transparency for students (M)
**Goal:** Students see why they scored what they did.
**Acceptance:** Seashell rationale per criterion visible on the student's submission; gate-failed submissions show per-test results; no answer keys or other students' data leak.

### T-11 Company shortlist / invite / export (M–L)
**Goal:** The loop ends at "shortlisted", not "ranked".
**Acceptance:** Hiring manager can shortlist, invite, and export top N as PDF; student sees the status; server-side ownership checks; new model documented.

### T-12 College / HOD dashboard (L)
**Goal:** Give the buyer a reason to pay.
**Acceptance:** New `college_admin` role (or equivalent); stats for participation, top students, active companies, problems solved, by department and over time; college-scoped only.

### T-13 Public student proof pages (M)
**Goal:** Shareable, opt-in page per student.
**Acceptance:** Slug URL; shows solved problems and scores; code visibility is opt-in; no PII beyond what the student allows; OG preview image.

### T-14 Landing "proof" section (M)
**Goal:** Show the loop working, not just describe it.
**Acceptance:** Screen recording or live mock of post → submit → rank → shortlist plus a number strip. Built last, from real screens.

## Later

| ID | Task | Effort | Acceptance (short) |
|---|---|---|---|
| T-15 | `/design-system audit` of the real code | S | Token coverage, hardcoded values, missing states; fills DESIGN.md gaps |
| T-16 | Real email provider (e.g. Resend) | S | `lib/email.ts` sends real verification emails; token flow unchanged |
| T-17 | Self-host Judge0 (official Docker compose) | M | Grading points at own instance; load-tested with N concurrent submissions |
| T-18 | Python function-signature grading | M | Harness parity with Java; 1e-6 double tolerance; adversarial tests |
| T-19 | C++ function-signature grading | M | Same as T-18 |
| T-20 | JavaScript function-signature grading | M | Same as T-18 |
| T-21 | Delete or fix `app/api/community/[collegeId]/route.ts` | S | Confirm whether it exists; remove or authenticate |
| T-22 | Finish `collegeName` / company-name cleanup on User | S | Proper `companyName` field; migration verified |
| T-23 | Isolated Mongo for query grading | S | `SANDBOX_MONGODB_URI` set and tested; zero leftover `tmp_eval_*` |
| T-24 | Buy Melodrame commercial license (confirm web embedding is covered) | S | Licensed file swapped in; `.gitignore` decision documented |
| T-25 | Clean transparent logo SVG with outlined wordmark | S | Replaces JPEG; used in `components/logo.tsx`, favicon, OG image |
| T-26 | Custom domain + update `metadata.url`, cookies, email links | M | `syncin.vercel.app` retired; redirects in place |
| T-27 | Plan for renaming the `seeby` DB | M | Migration script + rollback; only if worth it |
| T-28 | Analytics / event tracking for the success metrics in PRD §7 | M | Privacy-safe events; per-college reports feed the HOD dashboard |
| T-29 | Notifications (in-app first) | M | Shortlist, approval and test-deadline events |
| T-30 | Background jobs for ranking and auto-promotion | M | No request-time long work; retries visible |
| T-31 | Rate limiting on auth and grading routes | S | Limits and 429 behaviour tested |
| T-32 | Automated tests (API + Playwright smoke) and CI | M | Green pipeline on every commit |
| T-33 | Accessibility audit | M | Contrast, keyboard, reduced motion, alt text |
| T-34 | Diversify Shellfish variant openers | S | No uniform "You are the [C-level]..." opening |
| T-35 | Improve OCR for phone photos of handwriting | M | Measured accuracy gain on a small test set |
| T-36 | HOD pilot prep: 1-page pitch and a 3-minute demo script | S | Ready before the IBM visit |

## Found in code

`UNVERIFIED`. Have the agent grep for `TODO|FIXME|HACK` and list findings here with file paths (part of T-01).

## Blocked

| Item | Blocked by |
|---|---|
| Shipping the Melodrame font | Commercial license (T-24) |
| Production launch on public Judge0 | T-17 |
| Real verification emails | T-16 |
| Landing proof section | T-11, T-12 needed to have real screens |

## Done

- Pivot from SyncIn to a problem → submission → AI-rank platform; old MCQ/chat/community/collab features removed
- Seashell (AutoGen ranking), Shellfish (variants), Sand Flea (document extraction) built and verified
- App-wide auth fix: session cookie, `requireAuth()`, no client-trusted identity
- Hiring-manager email verification gate; company onboarding gate
- Mentor role and class assignments; classes, QR join, memberships, bulk approve
- Coding problems on Judge0 with correctness gate and telemetry; C and C++ added
- Java function-signature grading; Run vs Submit
- SQL and MongoDB query problems with two-layer protection
- Full-workflow integration audit; 5 gaps fixed (answer-key leak, duplicate race, invisible DB submissions, stats blind spot, `collegeId` type)
- Timed tests with server-side clock, autosave, auto-promotion
- Real logout with server-side revocation
- Role-based stats dashboard
- Warm app redesign; profile page; landing, splash, auth restyle
- **Rebrand to TACET** (cookie/storage constants, `tacet@` IDs, copy, JWT fallback removed, dead chat route deleted), verified live
- **Font migration** (Melodrame / Instrument Serif / Geist / Geist Mono) — applied and build-verified; browser verification still open (T-03)
- Documentation set (this folder)
- **T-04 Git hygiene:** the reported +1.37M lines came from the untracked `ranking-service/venv/` plus local Tesseract installers; the tracked diff was 6,523 additions / 7,212 deletions. Ignored local runtime, cache, uploads, installers, cookies, and probes.
- **T-05 Scratch-script cleanup:** read and deleted the Mongo status check, ranking generator check, password-reset script, and login probe. The password-reset script would have changed five users' password hashes and marked their emails verified; it was never run. Login remains unconfirmed because Codex cannot resolve the Mongo SRV record.
- **Upload security hardening:** authenticated, scoped serving; traversal/symlink containment; safe headers; SVG removal; writer-side size and magic-byte checks; dead legacy routes removed.
