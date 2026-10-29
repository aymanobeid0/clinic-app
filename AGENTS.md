# Clinic app

Online dental clinic MVP. Scope overview: docs/planning/mvp-scope.md. Behavior contract: docs/planning/spec-001-clinic-mvp.md with its linked approved amendments. Terminology: CONTEXT.md.

## Before implementation

- When resuming work, read HANDOFF.md for current context. Follow its evidence/history links only when relevant; dated archives are historical snapshots.

- Read the assigned GitHub issue, its acceptance criteria and open blockers. For tracker/readiness rules, read docs/agents/issue-tracker.md.
- For dependencies or architecture, read docs/planning/dependency-proposal.md and docs/architecture/application-architecture.md. Preserve the approved stack and Zustand/TanStack Query state boundaries.
- At the start of every authorized implementation, read design/design.md, the owner-approved application design guide, and identify the applicable rules. For interface changes, also read design/designtokens.md and inspect the relevant component specimens; apply the guide during implementation and independent visual review. For work with no interface impact, record that applicability once; no visual checks are required. Reuse the read within an unchanged ticket; reread for a new ticket or changed design requirements.
- For each authorized ticket, read docs/agents/skill-integration.md and complete its applicable skill, review and handoff checkpoints. Reuse unchanged instructions already read within that ticket; reopen relevant sections when requirements or scope change. A previous ticket's skill check does not satisfy the current ticket.

## Execution economy — owner instruction, 2026-10-25

Prioritize a working, usable clinic application and the requested outcome. Keep time, token use and change size proportional to the task; lines of code, test counts and process activity are not measures of delivery.

- Read the files and current service data needed for the change. Reuse stable context already established in the session; follow historical evidence only to resolve a concrete question.
- Make the smallest clear change that satisfies the request. Add abstractions, layers and documentation only when they solve an actual problem in that scope.
- Test observable behavior in proportion to impact. Reuse existing coverage; add focused regressions for meaningful risks. Run broader suites when required or justified by shared behavior, and repeat them only after relevant changes or failures.
- Keep updates brief and useful: findings, blockers, decisions and results. Avoid repeated unchanged status, long plans and duplicated evidence; keep detailed evidence in its existing report.
- When a required procedure would add disproportionate time or token cost, explain the concrete requirement and cost before doing it. This instruction narrows broader workflow/skill guidance that would otherwise create unnecessary work; preserve applicable safety boundaries and required independent implementation review.

## Boundaries

Use codex/ branch names and human-reviewed pull requests. Every merge requires human approval. Production deployment, live migrations and real patient data require separate authorization.

Keep GitHub Issues and the Clinic MVP Project synchronized with verified delivery. After an owner-approved merge, confirm its scope/evidence, close the completed issue and mark its project item Done. Before recommending work, reconcile issue/project status with merged PRs; a stale open issue is not evidence of missing implementation. Preserve native dependencies and keep deferred UI scope separate. Use closing issue references in implementation PRs where appropriate.

Resolve prerequisite decision issues #2-#6 against their current criteria and recorded owner decisions before dependent implementation. The ready-for-agent label records preparation, not execution authorization.

Use applicable Matt Pocock skills for discovery, specifications, tickets, implementation and review. User instructions override skills. Among skills, Matt Pocock guidance takes precedence; combine compatible guidance. The owner explicitly chose one worker per required role: one builder and one separate reviewer, who checks both standards and specification compliance. This overrides skill instructions to split review into multiple agents.

Preserve unrelated changes. Keep credentials out of commands, logs and commits. Report actual checks and remaining limitations.

## Connection failures

When a GitHub CLI or other external-service request fails, promptly tell the user which operation failed, the sanitized error, and which work is affected. Distinguish confirmed causes from hypotheses; a failed authentication check during a network failure does not establish that credentials are invalid.

Use a minimal read-only check to diagnose the failure. If sandbox network restrictions are suspected, retry through the supported approval mechanism when available, respecting any denial. Report whether that retry succeeds. If the problem persists or requires user action, explain the concrete remedy or ask for the specific access/setting needed. Keep credentials private and let the user complete interactive sign-in when necessary.

Continue independent authorized work, but keep work requiring unavailable current service data pending. Before finishing, report any unresolved connection blocker and its next step; do not silently substitute stale local tracker data for current GitHub criteria.
