# Clinic app

Online dental clinic MVP. Product decisions live in docs/planning/mvp-scope.md; implementation contract in docs/planning/spec-001-clinic-mvp.md; terminology in CONTEXT.md.

## Before implementation

- Read the assigned GitHub issue, its acceptance criteria, and every open blocker. For tracker and readiness rules, read docs/agents/issue-tracker.md.
- For dependencies or architecture, read docs/planning/dependency-proposal.md. Preserve the approved stack and Zustand/TanStack Query state boundaries.
- For board operations, read docs/super-board/PROJECT.md and docs/super-board/pre-flight.md. Local board policy and config override upstream skill defaults.
- For interface work, read design.md and designtokens.md; treat prototypes as visual references, with the approved spec governing behavior.

On Windows, run board shell helpers through `./scripts/board.ps1 helper .claude/bin/super-board-<name>.sh <args>` so workers inherit Git Bash and Python compatibility paths.

## Boundaries

Use codex/ branch names. Human approval is required for every merge. Production deployment, live migrations, and real patient data are outside autonomous board execution.

Keep unresolved decision tickets #2-#6 in Backlog until the owner approves their criteria. The ready-for-agent label records ticket preparation; only board Ready plus satisfied dependencies permits execution.

Use the installed Matt Pocock skills for discovery, specifications, tickets, implementation and review when their triggers apply. Super-board coordinates those activities; it does not replace the product specification.

<!-- super-board:begin v3.1.1 (managed; edits inside are overwritten on upgrade) -->
## Super Board

Board: Backlog · Ready · Building · QA · Review · Blocked · Done. Labels route: `qa` skips Building · `bug`, `feature`, none → built first.

| When | Use | NEVER |
|---|---|---|
| Set up / repair the board | `/super-board onboard` | DON'T hand-edit config mid-run |
| Check tickets before a run | `/super-board lint` | NEVER run with AC-less tickets |
| Drain the board | `/super-board run` | NEVER build, test or merge from the orchestrator |
| Board state / halt | `/super-board status` · `/super-board stop` | |
| Build one ticket | `/super-build` | NEVER build outside the card's worktree |
| QA a branch, or a live URL alone | `/super-qa` · `/super-qa <url>` | NEVER mark QA pass without evidence |
| Review a PR, merge | `/super-review` | NEVER `gh pr merge` direct — merge gate only |
| File bugs from Sentry, PostHog, PRs | `/super-collect` | DON'T file without a verifier pass |
| UI polish | `/ui-refine-loop` (human runs it) | board NEVER runs it |
| Diagram / explainer page | `/visual` | |
| Commit, pull, push this branch | `/git-sync` | NEVER force push or rebase shared history |

| Rule | Value |
|---|---|
| Config | `.claude/super-board/configs/<slug>.json` |
| Isolation | 1 card · 1 worktree · 1 branch |
| Merge | human approval for every PR; config is authoritative |
| Migrations | all database migrations require explicit approval; no database configured |
| Blocked card | block-template comment · last line `blocked-by:` · 🙋 = needs you |
| Secrets | NEVER read `.env`; key names via `.claude/bin/super-board-env-check.sh` |

## Writing (super-board)

| Thing | Format → `.claude/skills/super-board/references/writing-standard.md` |
|---|---|
| Commit, PR title | `<emoji> [type] scope: subject` + short bullets · ✨ feat 🐛 fix 🔧 chore ♻️ refactor 🧪 test 📝 docs |
| PR body | blocks: status · Problem · Solution · AC + proof · history · Before\|After · Risk — `super-board-pr-body.sh` |
| Ticket | Problem · Context · Fix · AC · Risk · Blocked by → `docs/agents/issue-tracker.md` |
| Comment | `[role] [label] status` · Did · ✅ Done · ❌ Not done · Next · ≤ 8 lines |
| PR author notes | file + critical inline review comments: Purpose · What changed · Why it matters → `pr-author-notes.md` |

- NEVER chain steps with arrows. One step per line, lettered under Where.
- NEVER link screenshots. Embed a raw URL pinned to a sha.
- DON'T repeat file lists in status comments. DON'T write "Not verified" or "Next" in a PR body.
<!-- super-board:end -->
