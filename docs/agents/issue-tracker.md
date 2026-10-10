# Issue tracker

GitHub Issues: https://github.com/aymanobeid0/clinic-app

Spec 001: https://github.com/aymanobeid0/clinic-app/issues/1
Execution board: https://github.com/users/aymanobeid0/projects/1

GitHub Issues are authoritative for current acceptance criteria and native blocking relationships. Local publication JSON is a publication snapshot, not a replacement for current issue bodies. Update local planning documents when decisions change.

The `ready-for-agent` label means prepared by the Matt Pocock specification/ticket workflow. It does not authorize execution. Only an approved card in board Ready with satisfied dependencies can run. Keep decision issues #2-#6 in Backlog until reviewed owner decisions are recorded. Keep Spec #1 outside the execution board and open until its acceptance is fulfilled.

Keep dependencies in both native GitHub blocking relationships and the issue body's `## Blocked by` section, because super-board parses the latter. Verify required implementation is merged into the base before promoting a ticket.

New tickets use Problem, Context, What to build, Acceptance criteria, Risk and Blocked by. Preserve existing approved ticket bodies and acceptance criteria; add missing operational context without replacing product decisions.

Routing labels: feature and bug use Build/QA/Review; qa uses QA/Review. PRs are not an incoming request surface. No automatic collectors are configured.

See docs/super-board/PROJECT.md for the operating routine, commands and merge policy.
