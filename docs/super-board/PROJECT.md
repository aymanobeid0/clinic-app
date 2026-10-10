# Clinic MVP execution system

Super-board 3.1.1 coordinates GitHub Project work. Matt Pocock skills remain the planning and engineering workflow. Use `grill-with-docs` for unresolved choices, `to-spec` for approved requirements, `to-tickets` for dependency-aware slices, then super-board for Build, QA and Review.

## Operating routine

1. Resolve decision/evidence issues #2-#6 with the owner. Save decisions and evidence before closing them.
2. Review a candidate issue against its current GitHub body, native blockers and `## Blocked by`. Verify required work is merged into the base, rather than relying only on a closed issue.
3. Move only executable, approved work into Ready. `ready-for-agent` alone is not a queue entry. Spec #1 stays outside the execution board.
4. In Codex, invoke `$super-board lint`, then `$super-board run clinic-mvp`. Codex uses its headless lane backend. Run only after the pre-flight checklist passes.
5. Inspect QA evidence and review results. Every PR waits for human merge. Use `codex/` branches targeting main; no production deployment is configured.
6. Verify the merged result and let the board reconcile Done. Use `$super-board stop` to stop; rerun to resume after checking preserved work.

## Local commands

Run `./scripts/board.ps1 check`, `status`, or `plan` from PowerShell. The wrapper selects Git Bash instead of the Windows WSL launcher, refreshes tool paths and supplies Python 3 compatibility. `plan` is read-only and launches no workers. For other board shell commands use `./scripts/board.ps1 helper .claude/bin/super-board-<name>.sh <args>`; launch Codex waves through this wrapper so child workers inherit the compatibility paths.

Open a fresh Codex chat in this project to discover skills under `.agents/skills/`. Claude copies also live under `.claude/skills/`, with CLAUDE.md pointing to AGENTS.md. Matt skills are vendored from the already installed plugin version 1.2.3; do not install another version silently.

## Policies and limits

The checked-in config is authoritative: one worker, every merge human-approved, no automatic live migrations. Main is an undeployed integration base for this blank repository; individual tickets use codex/ branches. Enable server-side protection when repository/account support permits it. The local pre-push hook is a convenience guard, not server-side protection.

Claude hook settings are installed for Claude Code. Codex does not execute Claude hooks; its actual protections are the configured merge gate, Git hooks, filesystem sandbox and project instructions. A worker may have write/network access needed to push a branch; review its diff before merging.

Application verification deliberately fails until a real package manifest, lockfile, typecheck, lint, tests and build exist. The foundation slice must establish these scripts. Documentation decisions use evidence review rather than claiming application tests passed.

No production server, credentials or patient data are configured. VPS assessment, backup feasibility, hosting/data handling and legal document requirements remain open in the existing decision tickets. No automatic telemetry collectors are enabled.

## Maintenance

The vendor installation is pinned in docs/super-board/installation.json. Update only while the board is idle; inspect upstream changes, rerun checks, and resynchronize Codex skill copies. Keep `.tools/` clones, runtime state and credentials out of Git. Preserve local compatibility patches when updating.
