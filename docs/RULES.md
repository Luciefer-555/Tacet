# RULES — TACET

**Purpose:** Conventions and hard rules for anyone (you, or an AI agent) changing this repo.
**Last updated:** 2026-09-21
**Read this when:** before every coding task. Agents: read this file and MEMORY.md first.

> **Source note.** Conventions here come from decisions already made in this project. Where I could not confirm a convention from the code, it says `UNVERIFIED` and should be checked against the repo.

---

## 1. Hard rules (never break)

1. **Never print, log, commit, or paste secrets.** That includes `.env*` contents, passwords, tokens, and connection strings. Refer to env vars by **name** only. Never `cat` an env file.
2. **Don't rename the MongoDB database (`seeby`), collections, Neo4j labels, or connection strings** without an explicit migration plan approved by the founder.
3. **Don't change the deployment URL (`syncin.vercel.app`)** until the custom domain is chosen.
4. **Every API route must authenticate** (`requireAuth()` / `getSession()`) and must scope data by role and ownership. Never trust an identity or role sent by the client (body, query, or localStorage).
5. **Answer keys never reach students.** `referenceSolution`, `expectedResult`, `referenceQuery` and hidden test cases stay `select: false` and are re-selected only in the grading path.
6. **Never trust an LLM's asserted correct output.** Expected outputs come from actually executing a reference solution in the sandbox.
7. **No scripts that write to the database without asking**, and never run one you haven't read. (A leftover status-check session produced `_status-reset-passwords.ts`. Read it, don't run it.)
8. **No hardcoded secret fallbacks.** If a required env var is missing, throw.
9. **Don't commit** `public/fonts/melodrame.*`, `uploads/`, `.env*`, `node_modules`, `.next`, or scratch files.
10. **Don't ship the Melodrame demo font.** Personal use only until a commercial license is bought.

## 2. Naming and branding

- Product name: **TACET** in headings, wordmarks, buttons, canvases. **Tacet** in sentences.
- Never introduce **SEBBY, SEEBY, SyncIn, Rhiley** in new user-facing text, code identifiers or comments. Allowed leftovers are listed in MEMORY.md ("Intentional legacy").
- Agent codenames stay: **Seashell**, **Shellfish**, **Sand Flea**.
- Profile IDs: new `tacet@...`; always parse both prefixes with `/^(syncin|tacet)@/`.
- Auth names come from `lib/constants/auth.ts` (`AUTH_COOKIE_NAME`, `AUTH_STORAGE_KEY`). Never hardcode the strings.

## 3. Code conventions

`UNVERIFIED` against the repo; adopt as the standard and let an agent confirm.

| Area | Convention |
|---|---|
| Language | TypeScript everywhere in `app/`, `lib/`, `models/`. No new plain JS outside `scripts/` |
| Components | One component per file, PascalCase component, kebab-case file names (`about-tacet.tsx`) |
| Placement | Page-level in `components/pages/`, reusable in `components/`, shared logic in `lib/`, Mongoose models in `models/` |
| API routes | `app/api/<area>/<action>/route.ts`. Return JSON with a consistent `{ error }` shape and correct status codes (400 validation, 401 no session, 403 wrong role or scope, 404, 409 duplicate) |
| Validation | Validate every request body server-side. Reject unknown formats and languages using an allowlist |
| Styling | Tailwind classes using tokens from `@theme`. No new hardcoded hex values. Use the four font classes only |
| Secrets/config | `process.env.X` accessed in one place per service (`lib/mongodb.ts`, `lib/neo4j.ts`, ...) |
| Errors | Handle expected failure states in the UI (409/403/404 inline). Never fail silently |
| Dependencies | Justify every new package in the PR/commit message. Judge0 has no network, so grading harnesses must be dependency-free |

## 4. How to add things

### A new API route

1. Create `app/api/<area>/<name>/route.ts`.
2. Call `requireAuth()` first; check role and ownership/scope.
3. Validate input; return proper status codes.
4. Sync to Neo4j only if the entity is part of the graph (see `lib/graphSync.ts`).
5. Add it to ARCHITECTURE.md §6.
6. Test the happy path and one rejection (wrong role or wrong college) with real requests.

### A new Mongoose model

1. Create it in `models/`.
2. Put unique indexes in the schema (duplicate races were a real bug: prove them with a concurrent test).
3. Mark answer keys and secrets `select: false`.
4. If it is a `Problem`-like collection with a `$jsonSchema` validator, update the validator too.
5. Add it to ARCHITECTURE.md §5.

### A new coding language

1. Get the real ID from `GET /languages` on the Judge0 instance. Don't hardcode remembered IDs.
2. Add to: the Add Problem form, the student language picker, CodeMirror mode, starter template, and **every server-side allowlist** (grep for existing languages to find them all).
3. Test: one pass, one wrong answer, one compile error, one infinite loop (confirm the time limit).
4. Check Shellfish reference-solution generation works for it.

### A new UI component

Use the tokens and font roles in DESIGN.md. Include empty, loading and error states from the start.

## 5. Security checklist for any change

- [ ] Route authenticated and scoped
- [ ] No client-trusted identity or role
- [ ] No answer key or hash in any response
- [ ] Inputs validated; no `eval`, no unparsed user queries reach a database driver
- [ ] No secrets in code, logs or docs
- [ ] File uploads restricted by type and size; stored under `uploads/` only

## 6. Agent rules

1. **Read first:** `docs/MEMORY.md`, this file, and the relevant ARCHITECTURE/DESIGN sections.
2. **Small commits, one concern each.** Commit before starting a big change.
3. **Run `npm run build` and typecheck before saying "done".** A passing build is necessary, not sufficient.
4. **No claim without evidence.** "Verified" means you showed a log, response, screenshot or `getComputedStyle` output. If you couldn't check something, say so.
5. **Don't touch what you weren't asked to.** No drive-by refactors, no renames, no dependency bumps.
6. **Ask before** running any script that writes to a database or deletes data.
7. **PowerShell caveat:** inline `node -e` with quotes gets mangled on Windows PowerShell. Write a script file and run that instead.
8. **Append durable learnings to `docs/MEMORY.md`** and record decisions in `docs/DECISIONS.md`.
9. **Stop and wait** when a task says stop. Don't chain into the next task.
10. **If a tool quota or error stops you mid-task,** report exactly what is done and what isn't, and don't claim completion.

## 7. Git

- Branch per task: `feat/<name>`, `fix/<name>`, `docs/<name>`, `chore/<name>`.
- Commit message format: `type: short summary` (`feat`, `fix`, `docs`, `chore`, `refactor`).
- Check `git status` and `git diff --stat` before every commit. An unexpectedly huge diff (hundreds of thousands of lines) means generated or vendored files are about to be committed. Stop and fix `.gitignore` first.
- Keep rebrand, fonts, and features in separate commits.

## 8. Related file

`.cursor/rules/tacet.mdc` is a short version of these rules that Cursor loads automatically.
