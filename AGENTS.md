# Clinic app

Online dental clinic MVP. Product decisions live in docs/planning/mvp-scope.md; implementation contract in docs/planning/spec-001-clinic-mvp.md; terminology in CONTEXT.md.

## Before implementation

- Read the assigned GitHub issue, its acceptance criteria and open blockers. For tracker/readiness rules, read docs/agents/issue-tracker.md.
- For dependencies or architecture, read docs/planning/dependency-proposal.md and docs/architecture/application-architecture.md. Preserve the approved stack and Zustand/TanStack Query state boundaries.
- For interface work, read design/design.md and design/designtokens.md (or the root design.md and designtokens.md before their relocation is published); prototypes are visual references, with the approved spec governing behavior.
- Before every authorized ticket implementation, review, and PR opening, read docs/agents/skill-integration.md and complete its applicable per-ticket skill and handoff checkpoints. A previous ticket's skill check does not satisfy the current ticket.

## Boundaries

Use codex/ branch names and human-reviewed pull requests. Every merge requires human approval. Production deployment, live migrations and real patient data require separate authorization.

Resolve prerequisite decision issues #2-#6 against their current criteria and recorded owner decisions before dependent implementation. The ready-for-agent label records preparation, not execution authorization.

Use applicable Matt Pocock skills for discovery, specifications, tickets, implementation and review. User instructions override skills. Among skills, Matt Pocock guidance takes precedence; combine compatible guidance. The owner explicitly chose one worker per required role: one builder and one separate reviewer, who checks both standards and specification compliance. This overrides skill instructions to split review into multiple agents.

Preserve unrelated changes. Keep credentials out of commands, logs and commits. Report actual checks and remaining limitations.

## Connection failures

When a GitHub CLI or other external-service request fails, promptly tell the user which operation failed, the sanitized error, and which work is affected. Distinguish confirmed causes from hypotheses; a failed authentication check during a network failure does not establish that credentials are invalid.

Use a minimal read-only check to diagnose the failure. If sandbox network restrictions are suspected, retry through the supported approval mechanism when available, respecting any denial. Report whether that retry succeeds. If the problem persists or requires user action, explain the concrete remedy or ask for the specific access/setting needed. Keep credentials private and let the user complete interactive sign-in when necessary.

Continue independent authorized work, but keep work requiring unavailable current service data pending. Before finishing, report any unresolved connection blocker and its next step; do not silently substitute stale local tracker data for current GitHub criteria.
