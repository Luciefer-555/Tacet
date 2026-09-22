# DECISIONS — TACET

**Purpose:** Why things are the way they are, so nobody (including you in three months) relitigates them by accident.
**Last updated:** 2026-09-21
**Read this when:** you are about to change something that "looks wrong" or you are making a real trade-off.

Format: **Decision · Context · Options · Why · Consequences.** Rationale I inferred instead of being told is marked `UNVERIFIED rationale`. Dates are approximate where not known.

---

## D-01 Pivot SyncIn into a problem → submission → AI-rank platform
- **Date:** before Sep 2026
- **Context:** A one-year-old student platform (MCQ prep, chat mentor, community, collaboration) had no clear buyer. Discussion with the HOD: build an MVP; HOD to raise it with IBM.
- **Options:** keep the broad student platform · narrow to the hiring loop.
- **Why:** The loop (companies post real problems, AI pre-screens, top solutions reach hiring) has a clear buyer (college) and pilot path (IBM).
- **Consequences:** Removed MCQ engine, chat mentor, community feed, collaboration hub, progress tracker, hackathons, resources, assistant. Dead code deleted, not just unlinked.

## D-02 College buys a subscription
- **Context:** Companies and students need to want it, but someone has to pay.
- **Why:** Colleges care about placements; a subscription fits their budgeting.
- **Consequences:** The HOD/admin dashboard becomes the revenue justification (T-12), and is still missing.

## D-03 Tech jobs only for now
- **Why:** Focus. Sales, media, bio, consulting, design and finance tracks discussed earlier were deprioritized.
- **Consequences:** Problem formats skew technical (coding, SQL, Mongo, open-ended).

## D-04 Rename SEBBY → TACET
- **Date:** Sep 2026
- **Context:** The new logo (ring of sharp four-point spikes) resembles the "tacet mark" and reads as a portal between spaces/times.
- **Options:** keep SEBBY · ocean-themed names (Orca, Tide, Reef, Current, Nautilus, Kelp) · TACET.
- **Why:** TACET fits the logo and story; "it is silent" = let the work speak.
- **Consequences:** Full rebrand pass. Agent codenames (Seashell, Shellfish, Sand Flea) kept as internal names even though they were ocean-themed to match SEBBY.

## D-05 Keep the Mongo DB name `seeby`, connection strings, and the `syncin.vercel.app` URL
- **Why:** Renaming a live database or collections without a migration can orphan data. The URL changes when a domain exists.
- **Consequences:** Legacy names remain in `.env.local`, scripts and metadata. Listed in MEMORY as intentional. A rename plan is a separate task (T-27).

## D-06 Dual profile-ID prefix (`tacet@` new, `syncin@` old)
- **Why:** Existing accounts must keep working.
- **How:** Parse with `/^(syncin|tacet)@/`; new IDs use `tacet@`; no DB rewrite.
- **Consequences:** Every place that parses an ID must accept both.

## D-07 Central auth constants; new cookie and storage names
- **Decision:** `AUTH_COOKIE_NAME = 'tacet_session'`, `AUTH_STORAGE_KEY = 'tacet_user'` in `lib/constants/auth.ts`.
- **Why:** One source of truth prevents a reader and writer disagreeing on the name.
- **Consequences:** All users logged out once; old cookie is ignored.

## D-08 Remove the hardcoded JWT fallback secret
- **Why:** A guessable fallback secret is a security hole. Fail loudly if `JWT_SECRET` is missing.
- **Consequences:** The app won't start without the env var, which is intended.

## D-09 Session auth via JWT (jose) in an HTTP-only cookie, with server-side revocation
- **Context:** Early routes trusted a client-supplied `profileId`/username with no session check. A repo-wide audit fixed it.
- **Why:** Identity must come from the server. `loggedOutAt` gives true logout without a session store.
- **Consequences:** Logout is global (all devices). `AuthProvider` revalidates via `/api/user/profile` on load. Trade-off accepted.

## D-10 Multi-agent AI ranking (Seashell), variants (Shellfish), extraction (Sand Flea) on NVIDIA NIM
- **Options:** single-prompt scoring · local Ollama model · NIM-hosted models (20+ tested).
- **Why:** A panel (Technical/Business/Originality + Judge) gives more defensible scores. `nemotron-3-nano-omni-30b-a3b-reasoning` was chosen after testing. `UNVERIFIED rationale` for exact selection criteria.
- **Consequences:** Separate Python FastAPI service; model-quality ceiling on variant phrasing accepted.

## D-11 Correctness gate before AI ranking
- **Why:** Ranking code that doesn't work wastes AI cost and misleads hiring teams.
- **Consequences:** Failed submissions stored with per-test results, never scored.

## D-12 Never trust the LLM's asserted output for coding tests
- **Why:** LLMs get expected outputs wrong. Shellfish writes a reference solution and executes it; only the sandbox output counts. Failing candidates get one regeneration, then are dropped.

## D-13 Judge0 for code execution, Piston only as optional fallback
- **Context:** Public Piston API is whitelist-only. Judge0 halved average sandbox time (about 3.2s → 1.56s).
- **Consequences:** Public Judge0 CE is fine for dev; self-host before production (T-17).

## D-14 Two grading modes for coding: `stdin_stdout` and `function_signature`
- **Why:** LeetCode-style is friendlier. Old problems default to stdin/stdout.
- **Consequences:** Function-signature is Java-only for now (staged build). Doubles compared with 1e-6 tolerance; everything else exact.

## D-15 Database-query problems are a separate system (`DbProblem` / `DbSubmission`)
- **Why:** Different shape and deterministic grading. No AI ranking.
- **Consequences:** Separate panels and stats handling. Merged into `/api/problems` list and totals, but AI-score fields stay Submission-only.

## D-16 SQL and Mongo query grading safety model
- **SQL:** stdlib sqlite3 in `:memory:`, keyword blocklist plus `PRAGMA query_only = 1`.
- **Mongo:** parse strictly as JSON, pass to native driver, never `eval`, reject `$where` and similar, ephemeral `tmp_eval_*` collections dropped in `finally`.
- **Accepted trade-off:** Mongo grading runs on the production Atlas cluster. `SANDBOX_MONGODB_URI` designed as the later escape hatch.

## D-17 Answer keys are `select:false`
- **Context:** A P0 leak returned `expectedResult`/`referenceQuery` to any authenticated user. Fixed and regression-tested.
- **Consequences:** Only the grading path re-selects them.

## D-18 Mentor role reuses the hiring-manager UI
- **Why:** Same jobs (post, view submissions, rank) with different copy; less code.
- **Consequences:** Role-aware copy in one component. Class assignments are same-college only (Option A, deliberately chosen over open-to-all).

## D-19 Company onboarding gate, enforced server-side
- **Why:** Fixes the company-name-in-`collegeName` overload and gives problems a real company identity.
- **Consequences:** All problem-creation routes return 403 for un-onboarded companies (confirmed by direct API bypass test).

## D-20 Timed tests are server-authoritative, with dropped-connection auto-promotion
- **Why:** Client clocks can't be trusted. If a final submit never arrives, the last autosave is promoted after deadline + 5 min.
- **Consequences:** Opportunistic (next API call), flagged to the student as `autoPromoted`. Shares one grading function (`lib/submissionGrading.ts`) with normal submissions to prevent drift.

## D-21 Two visual themes: dark landing, warm cream app
- **Why:** Landing sells mood; the app is where people work.
- **Consequences:** They must not be mixed. Fraunces was the old app heading font, replaced by Instrument Serif.

## D-22 Font stack: Melodrame (display) + Instrument Serif + Geist + Geist Mono
- **Options:** Instrument Serif + Geist + Geist Mono alone · Syne/Unbounded · Satoshi/General Sans · plus Melodrame for the wordmark and hero.
- **Why:** Melodrame gives the hero personality; the others stay quiet. Melodrame is limited to the wordmark and hero to avoid clashing with the second serif.
- **Consequences:** The DaFont file is a personal-use demo. Don't ship or redistribute it. Buy a commercial license (check that web embedding is covered). Until then it is gitignored, and builds need a fallback (T-02). Long-term the wordmark should be an SVG with outlined text.

## D-23 Remove the old chat route
- **Why:** No callers remained. Renaming dead code is waste; deleting it removes attack surface.

## D-24 Docs live in `/docs`, and agents read them first
- **Why:** Agent tools reset context between sessions and quotas force tool switching. The docs are portable context.
- **Consequences:** Keep MEMORY and TASKS current at the end of every task (see FLOW Part B).
