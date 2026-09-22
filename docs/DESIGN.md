# DESIGN — TACET

**Purpose:** Brand, tokens, typography, components and patterns, plus the gaps.
**Last updated:** 2026-09-21
**Read this when:** you touch UI, add a component, or brief a designer or an agent.

> **Source note.** Reconstructed from the design work done so far, not from an audit of `globals.css` and the components. Values I could not confirm are marked `UNVERIFIED`. First task for an agent: run a `/design-system audit` against the real code (TASKS T-15).

---

## 1. Brand

- **Name:** TACET. Latin for "it is silent" (a musical rest). Also the "portal between spaces/times" idea from the logo.
- **Logo:** a ring of eight sharp four-point spikes, needle-thin, high-contrast, black on off-white. Tapered spikes; the whole mark has a quiet sci-fi feel.
- **Wordmark casing:** `TACET` (all caps) in logos, headings, buttons, canvases. `Tacet` in running sentences, meta descriptions and alt text.
- **Tone:** sharp, calm, confident. Less startup-bubbly, more "quiet proof".
- **Logo asset TODO:** the current logo is a JPEG on a grey background. Produce a transparent SVG with the wordmark converted to outlines, so it doesn't depend on a font file.

## 2. Two visual themes (deliberate)

| Surface | Theme | Why |
|---|---|---|
| Landing, hero splash, login, signup | **Dark, dot-matrix / halftone** (WebGL dither, `DecryptedText`, 3D lanyard) | Mood and first impression |
| Authenticated app (Dashboard, Problem Statements, Profile, top nav) | **Warm cream / YC-style** | Readable, work-focused |

Keep them separate. The app redesign intentionally left the landing/auth pages untouched.

## 3. Color tokens

`UNVERIFIED` exact token names; check `app/globals.css` (`@theme`).

| Role | Value | Notes |
|---|---|---|
| App background | `#FAF7F2` | Cream |
| App text | `#1A1A1A` | Near-black |
| Accent | `#3F3FF3` | Blue accent kept from the earlier design |
| Landing background | Dark / near-black | Dither background |
| Buttons (app) | Black pill | |
| Danger (failed variant card) | Red border | `generationFailed: true` |

Gaps: no documented success/warning/info semantic colors, no dark-mode for the app shell (`UNVERIFIED`).

## 4. Typography

| Tailwind class | Font | Used for | Notes |
|---|---|---|---|
| `font-display` | **Relationship of Melodrame** (`public/fonts/melodrame.ttf`, `next/font/local`) | TACET wordmark and landing hero headline **only** | **Demo file, personal use only.** Gitignored. Buy a commercial license before shipping. Confirm the license covers web/app embedding |
| `font-serif` | **Instrument Serif** (regular + italic) | Section headings in the app, `.agent-name` | No bold weight exists. Use size or italic for emphasis, never faux bold |
| `font-sans` | **Geist** | Body text and all UI chrome | Default |
| `font-mono` | **Geist Mono** | Scores, IDs, badges, tagline, test-case display | CodeMirror uses its own monospace stack |

Rules:
1. Never use `font-display` outside the wordmark and hero. It is dramatic and fights other serifs.
2. Give every font a real fallback stack. Text that falls back to Times or Arial is a bug.
3. Canvas draws (lanyard card, Wrapped export) set fonts through `ctx.font`. They must `await document.fonts.load(...)` before drawing or they silently fall back.
4. Tailwind v4: define families in the `@theme` block; `tailwind.config.js` is ignored unless linked with `@config` (see T-03).

Deploy fallback: if `melodrame.ttf` is missing at build time, `--font-display` should fall back to Instrument Serif so builds don't crash (T-02).

## 5. Spacing, radius, elevation, motion

`UNVERIFIED`: no spacing scale or radius tokens are documented. Proposed default until audited: Tailwind's default scale, `rounded-full` for pill buttons, `rounded-xl` for cards, minimal shadow on the cream theme.

Motion in use (landing only): dither WebGL background, `DecryptedText` scramble tagline, staggered headline reveal, 3D physics lanyard, splash video with soft-pulsing "touch here" prompt. Respect `prefers-reduced-motion` (the splash does; confirm the others).

## 6. Components and patterns in use

| Component / pattern | File (UNVERIFIED unless noted) | Notes |
|---|---|---|
| Top nav (logo, Dashboard, Problem Statements, profile dropdown) | `components/navbar.tsx` | Dropdown: Profile, About Tacet, Log Out |
| Header / footer (landing) | `components/header.tsx`, `components/footer.tsx` | |
| Landing hero | `components/hero-section.tsx`, `components/home/hero-section.tsx` | Two versions exist; check for duplication |
| Splash | `components/hero-splash.tsx` | Paused on frame 1, pulses, skip button |
| Features / CTA | `components/features-3.tsx` (`#why-tacet`), `components/call-to-action.tsx` | |
| Lanyard + card | `components/lanyard-with-controls.tsx`, `components/card-template.tsx` | |
| Role-aware problem page | `components/pages/problem-statements.tsx` | Student, hiring manager and mentor share it |
| Student Classes page | `components/pages/classes.tsx` | Top-level student Classes tab; reuses `StudentClassJoinBar` for join code, password, status, and enrolled-class display |
| Add Problem form | inside `problem-statements.tsx` | Format selector first, then conditional fields |
| Stats dashboard | `components/pages/wrapped-dashboard.tsx` | Single warm theme; canvas export |
| Profile | `components/pages/profile.tsx` | Tag input for skills |
| Classes hub | `components/classes-hub.tsx` | Mentor and student class UI |
| DbProblem editor | `components/db-problem-editor.tsx` | Student-only SQL/Mongo workspace: schema browser at left, CodeMirror query editor, Run preview, tabular output and literal inline errors; Submit stays in the parent graded form |
| Dataset upload | `components/pages/problem-statements.tsx` | Creator-only CSV/JSON upload, inferred type confirmation, first-10-row preview; manual seed text remains the fallback |
| Code editor | CodeMirror in `problem-statements.tsx` | Language picker, Run/Submit |
| Logo | `components/logo.tsx` | One-swap component for the SVG |
| Auth pages | `app/login/page.tsx`, `app/signup/page.tsx` | Split screen, accent panel + dark form |

Patterns already established:
- **Honest empty state:** the stats dashboard uses an `isCalibrating` flag ("not enough activity yet") instead of fabricating data.
- **Distinct loading states:** e.g. "Reading your file…" during document extraction.
- **Inline error mapping:** 409 duplicate, 403 forbidden, 404 not found shown inline.
- **Copy-to-clipboard** on newly created IDs.
- **Failed items are visible, not hidden** (red-bordered variant cards).

## 7. Empty and loading states (convention to adopt)

Every empty panel should answer "what do I do next?" with one primary action.

| Panel | Empty message | Action |
|---|---|---|
| Student: no submissions | "You haven't solved anything yet." | "Browse problems →" |
| Hiring manager: no problems | "Post your first problem." | "Add problem →" |
| Hiring manager: no submissions | "No submissions yet. Share the problem ID with students." | Copy problem ID |
| Mentor: no classes | "Create your first class." | "New class →" |
| Stats | Calibrating state | "Submit 2 solutions to unlock your persona" |

## 8. Accessibility

`UNVERIFIED`: no audit done. Baseline to check:
- Color contrast of `#3F3FF3` on cream and on dark.
- Keyboard access for the top nav dropdown, editor Run/Submit, the class join flow.
- Focus rings on black pill buttons.
- `aria-label`s (present on logo links; extend to icon-only buttons).
- Reduced motion for every animated landing element.
- Text alternatives for canvas exports (lanyard card, Wrapped).

## 9. Do and don't

| Do | Don't |
|---|---|
| Keep landing dark and app cream | Mix the two themes on one page |
| Use Melodrame only for wordmark and hero | Use it for headings or body |
| Use size/italic for emphasis with Instrument Serif | Apply `font-bold` to a font with no bold |
| Show honest empty states | Fill dashboards with fake zeros or invented personas |
| Put the wordmark in an SVG with outlined text | Rely on a licensed font file inside the logo |

## 10. Gaps (audit targets)

1. No written token list, and hardcoded hex/px values likely exist (`/design-system audit`).
2. Two hero components and two "wordmark" implementations may drift.
3. No documented component states (hover, disabled, loading, error) for buttons and inputs.
4. No semantic colors for success/warning/info.
5. No app dark mode.
6. Accessibility not audited.
7. No design tokens for the landing's dither/lanyard visuals (colors are probably inline).
