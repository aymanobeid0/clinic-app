# Local demo removal review — 2026-10-19

Single independent reviewer; no implementation edits or extra agents. Freshly read AGENTS.md, docs/agents/skill-integration.md and `.agents/skills/code-review/SKILL.md` for this cleanup. Applied both Standards and direct-owner-spec axes, including the Fowler smell baseline; owner override replaces the skill's parallel reviewers. Implementation/TDD, UI/design and discovery skills were considered but skipped: this is removal of a failed dev-only harness, without new behavior or design. No assigned GitHub ticket or new external-service dependency applies to this explicitly owner-approved local cleanup.

Pinned and independently resolved base `0de142ff958558ec6ac4d25b43762941e4fc1caa` and HEAD `97905e1add9d19d724cb7b6ccff8dc9a3fba9d65`. Inspected nonempty `git diff 0de142ff958558ec6ac4d25b43762941e4fc1caa...HEAD` and its one-commit log. Direct owner scope: remove yesterday's failed demo/local database setup, including launcher and Start command; preserve automated tests/application work; keep cleanup local with no PR publication.

## Standards

0 findings. Deleted files belong to the dedicated demo harness; npm/config/docs changes remove corresponding entry points. No new Fowler-baseline smell or documented-standard breach found.

## Spec

0 findings. Launcher/config/start-stop files, development mail/seed/prepare/server helpers and dedicated Compose/runtime SQL are removed. Vite restores prior defaults. Automated API/browser tests, isolated-test Compose/runtime SQL, production application code and billing work are unchanged by the cleanup diff. Tracked reference search found no dangling imports or active instructions targeting deleted files. Remaining `.local-dev` references concern ignored reconciliation evidence, exclusions and explicitly historical review records; inspected ignored directory contains only reconciliation and issue-20 PR evidence.

Reviewer directly ran `git diff --check` and `npm run typecheck`: passed on the reviewed HEAD. Builder reports lint/build passed (existing bundle-size warning only) and final Docker/process readback confirms dedicated resources are gone; reviewer did not independently execute those operational deletions/readbacks or rerun full PostgreSQL/browser suites. Those suites were unnecessary for the removed dev-only harness. No production operation, merge, push or PR was performed by reviewer.

Disposition: Standards 0; Spec 0. Cleanup passes independent review within the explicit removal scope. Historical demo acceptance claims do not establish owner-usable local testing.
