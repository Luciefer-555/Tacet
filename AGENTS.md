# TACET agent rules

Read `docs/README.md`, `docs/MEMORY.md`, and `docs/RULES.md` before work; then read the relevant architecture, design, or flow doc.

1. Never print, log, paste, or commit secrets, `.env*` contents, passwords, tokens, or connection strings. Refer to env vars by name only.
2. Do not rename MongoDB `seeby`, collections, Neo4j labels, connection strings, or `syncin.vercel.app` without an approved migration.
3. Authenticate and role/ownership-scope every API route. Never trust client-supplied identity, role, or ownership.
4. Keep answer keys and hidden tests `select: false`; expose them only to grading paths.
5. Do not trust LLM-provided expected output; execute the reference solution in the sandbox.
6. Ask before running any database-writing or destructive script. Read scripts before running them.
7. Required configuration has no hardcoded secret fallback; missing required variables must throw.
8. Do not commit fonts, `uploads/`, `.env*`, `node_modules`, `.next`, or scratch files.
9. Use TACET/Tacet branding; preserve intentional legacy names in `docs/MEMORY.md`.
10. Keep parsing both `syncin@` and `tacet@` profile prefixes. Use auth constants, not hardcoded names.
11. Validate server-side inputs, return correct API status codes, and handle expected UI errors.
12. Use existing Tailwind tokens and font roles; justify every new dependency.
13. Keep changes scoped. Check git status and diff stat before commits; never claim verification without evidence.
14. Run the relevant typecheck/build and real request or browser checks before calling work done.
15. Record durable discoveries in `docs/MEMORY.md`, decisions in `docs/DECISIONS.md`, and stop when asked.
