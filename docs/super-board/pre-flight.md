# Before the first execution run

- GitHub CLI is authenticated with repository and project access; Codex CLI is authenticated.
- The project has all seven statuses and only reviewed implementation tickets enter Ready.
- Owner decision tickets #2-#6 have reviewed evidence and explicit acceptance; all candidate blockers are resolved and their required code is in the base.
- A clean committed base exists on GitHub. Local uncommitted work is preserved before workers start.
- `./scripts/board.ps1 check` passes; `plan` selects exactly the intended tickets, with one-worker concurrency configured.
- The application verification command fails until real checks are implemented. Update it only to actual passing checks, never an echo/success placeholder.
- Every merge remains human-approved. Production deployment, real-patient use and live migrations require a separate explicit instruction.
- Test fixtures contain fictional data. Restore rehearsal remains a distinct pilot acceptance gate.
