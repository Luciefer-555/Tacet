# TACET docs

Start here. One line per doc, plus when to read it.

| Doc | What it answers | Read when |
|---|---|---|
| [PRD.md](PRD.md) | What is TACET, for whom, what is built vs planned, how it earns | Explaining the product, choosing what to build, pitching |
| [FLOW.md](FLOW.md) | How each flow works, and how you work with AI agents | Learning the system; before starting any task |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Components, data model, APIs, auth, grading, AI pipeline | Changing backend code; debugging |
| [RULES.md](RULES.md) | Hard rules, conventions, agent rules | Before every coding task |
| [DESIGN.md](DESIGN.md) | Brand, tokens, fonts, components, empty states | Touching UI |
| [TASKS.md](TASKS.md) | Now / Next / Later / Blocked / Done | Picking work; updating status |
| [MEMORY.md](MEMORY.md) | Dense day-one facts and gotchas for agents | Start of every session |
| [DECISIONS.md](DECISIONS.md) | Why we chose what we chose | Before changing something that "looks wrong" |

**Suggested reading order for you:** PRD → FLOW → ARCHITECTURE.

**Suggested prompt opener for any agent:** "Read docs/MEMORY.md and docs/RULES.md first, then do: ..."

**Trust level.** These docs were written from the project history, not a fresh scan of the code. Anything marked `UNVERIFIED` needs checking against the repo (TASKS T-01). Never put secrets in any doc.
