# PRD — TACET

**Purpose:** What TACET is, who it is for, what is built vs planned, and how it makes money.
**Last updated:** 2026-09-21
**Read this when:** you need to explain the product, decide what to build next, or prep a pitch.

> **Source note.** Written from the project history (what has been built and verified so far), not from a fresh read of the repo. Anything I could not confirm is marked `UNVERIFIED`. A coding agent should verify these against the code before they are treated as fact (see TASKS T-01).

---

## 1. One-liner

TACET is a university-partnered platform where companies post **real problems**, students submit solutions, an **AI panel pre-screens and ranks** them against a rubric, and only the top solutions reach the company's hiring team.

Name history: SyncIn → SEBBY → TACET. The logo (a ring of sharp four-point spikes) doubles as a "portal between spaces/times" mark, hence the name.

## 2. Problem

| Who | Pain |
|---|---|
| **Students** | Résumés and campus tests say little about real ability. Interns need ~1 week of ramp-up before they are useful. |
| **Companies** | Campus hiring is noisy. Screening hundreds of applicants for a few interns is expensive. |
| **Colleges** | Placement outcomes and industry links are what they compete on, and they have no proof-of-skill layer. |

**Pitch angle (Bengaluru Tech Week):** students prove themselves on real problems *before* the internship starts, which removes most of the ramp-up week.

## 3. Users and roles

| Role | Built? | Scope | What they do |
|---|---|---|---|
| **Student** | Built | College-scoped (`collegeId`) | Solve problems, join classes, take timed tests, see own stats |
| **Hiring manager** | Built | Company-scoped (`companyId`) | Complete company onboarding, verify email, post problems, view ranked submissions |
| **Mentor / professor** | Built | College-scoped | Create classes, post class assignments, approve join requests, see per-student class activity |
| **College admin / HOD** | **Planned** | College-wide | See participation, top students, active companies (the buyer's dashboard) |

Accounts use a **Profile ID**: new ones are `tacet@XXX000`, legacy ones are `syncin@XXX000` (both valid).

## 4. Core loop

```
Company/mentor posts problem -> student submits -> (coding: correctness gate) -> AI ranks -> hiring team sees top solutions
```

Only submissions that pass the correctness gate (coding) reach AI ranking. Database problems are graded deterministically and do **not** go through the AI ranker.

## 5. Feature inventory

Status: **Built** = implemented and verified at least once end to end. **Partial** = works with known gaps. **Planned** = not started.

### Problems and submissions

| Feature | Status | Notes |
|---|---|---|
| Open-ended problems (text/file answer) | Built | Ranked by Seashell |
| Coding problems, stdin/stdout grading | Built | Python, Java, C, C++ via Judge0 |
| Coding problems, function-signature grading (LeetCode-style) | **Partial** | Java only. Python/C++ not built |
| SQL problems | Built | Separate `DbProblem`/`DbSubmission` system, sqlite in-memory |
| MongoDB query problems | Built | Ephemeral collections on the app's Atlas cluster (see risks) |
| Run (visible tests) vs Submit (all tests) | Built | Run writes nothing to the DB |
| Correctness gate before AI ranking | Built | Failed submissions stored with per-test results, never scored by AI |
| File-upload submissions (PDF/PPTX/DOCX/image) | Built | Sand Flea extraction (text → OCR → vision model) |
| Problem variants from a hiring-manager brief | Built | Shellfish; one rubric, several framings; SHA-256 based assignment |
| Structured "Add Problem" form (format first, then fields) | Built | Shared by hiring managers and mentors |
| Problem list endpoint scoped to own company/college | Built | Merges `Problem` and `DbProblem` |

### Classes and tests

| Feature | Status | Notes |
|---|---|---|
| Mentor-owned classes with class ID, password, QR code | Built | QR encodes class ID only; password still required |
| Join requests (pending / approved / rejected) | Built | Individual and bulk approve |
| Per-student, class-scoped activity view for mentors | Built | |
| Timed coding tests | Built | Server-side clock, autosave, auto-submit |
| Auto-promotion of last draft after dropped connection | Built | Flagged `autoPromoted` in UI |

### Accounts and trust

| Feature | Status | Notes |
|---|---|---|
| Signup/login with JWT session cookie | Built | Cookie `tacet_session` |
| Server-side logout (revokes all sessions) | Built | `loggedOutAt` check against token `iat` |
| Hiring-manager and mentor email verification | **Partial** | Flow works; `lib/email.ts` is a console-log stub, no real emails sent |
| Company onboarding gate | Built | Enforced on all problem-creation routes |
| Profile page (name, college, branch, year, skills, avatar) | Built | |
| Password reset / recovery | `UNVERIFIED` | Pages exist (`forgot-password`, `recover-credentials`); depth of backend not checked |

### Stats and presentation

| Feature | Status | Notes |
|---|---|---|
| Role-based stats dashboard | Built | `/api/stats/{student,mentor,hiring-manager}`; honest "calibrating" state |
| Student persona card | Built | From real submission behavior; needs 2+ submissions |
| Shareable card / export image | Built | Canvas-based; lanyard card and Wrapped export |
| Landing page (dither background, 3D lanyard, splash video) | Built | Dark theme, separate from the app |
| App shell (warm cream theme) | Built | Dashboard, Problem Statements, Profile |

### Not built yet

| Feature | Why it matters |
|---|---|
| **College/HOD dashboard** | The buyer has no view; this is the subscription's value |
| **Company shortlist / invite / export top-N** | The loop ends at "ranked"; the pitch promises "hired" |
| **Ranking transparency for students** | Seashell rationales exist; students don't see why they scored what they did |
| **Public student proof pages** | Shareable proof of skill; free growth channel |
| **Demo/seed data and empty states** | Fresh accounts look empty, which weakens demos |
| **More languages** (JS, TS, Go, Rust, Kotlin, C#) | Judge0 supports them; needs IDs, templates, allowlist changes |
| **Real email provider** | Verification emails are not actually sent |
| **Landing "proof" section** | Shows the loop working instead of describing it |

## 6. Business model

The **college buys a subscription** and adopts the platform. Companies (starting with a possible IBM pilot via the HOD) supply problems; students and mentors use it for free.

Implication: the HOD/admin dashboard is the product's revenue justification, and today it does not exist.

## 7. Success metrics (proposed, not yet instrumented)

| Metric | Why |
|---|---|
| Active students / total invited (per college) | Adoption |
| Problems posted per active company | Supply |
| Submissions per problem | Demand |
| % submissions passing the correctness gate | Problem difficulty calibration |
| Shortlists made per problem | The loop actually closing |
| Time from post to first shortlist | Hiring-side value |

`UNVERIFIED:` no analytics or event tracking was confirmed in the codebase.

## 8. Scope decisions and non-goals

- **Tech jobs only for now.** Sales, media, bio, consulting, design and finance tracks are deprioritized.
- **Stripped from the old SyncIn:** MCQ prep engine, chat mentor, community feed, collaboration hub, progress tracker, hackathons, resources, assistant chat.
- **Not doing (MVP):** OAuth/SSO (removed the fake buttons), payments in-app, mobile app, proctoring/anti-cheat beyond server-side timers.

## 9. Risks

| Risk | Severity | Note |
|---|---|---|
| Public Judge0 rate limits / shared tenancy | High for production | Self-host before real load |
| Mongo query grading on the production cluster | Medium | `SANDBOX_MONGODB_URI` escape hatch designed, not used |
| Demo-only Melodrame font | High if shipped | Personal-use license; buy commercial license before deploy |
| Email stub | Medium | Verified accounts can't self-serve in production |
| No demo data | Medium | Hurts every live demo |
| Tesseract quality on phone photos | Low | Vision-model fallback covers much of it |
| Single-founder bandwidth | High | Prioritize the buyer's dashboard and the shortlist flow |

## 10. Open questions

- What does the HOD need on day one to justify paying? (Ask them.)
- Pricing unit: per student, per department, flat per college?
- What does IBM (or any company) need to see to post a real problem?
- Where does data live and who owns it (student submissions, company briefs)?
