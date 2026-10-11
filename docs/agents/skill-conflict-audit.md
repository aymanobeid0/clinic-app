# Workflow simplification — 2026-10-10

The owner chose to remove super-board after reviewing its integration overhead. Its local launchers, configuration, hooks, eight vendor skills, source clone, compatibility scripts and operating documents were removed. Matt Pocock skills, product/specification/architecture documents and GitHub issues/dependencies remain. The GitHub project remains optional manual tracking; no remote resources were deleted.

The active workflow is one builder and one separate reviewer. A single reviewer checks both standards and specification compliance. This explicit user instruction overrides the Matt skill's multiple-reviewer requirement. Use one worker per any other required role; ordinary implementation does not require a separate QA worker.

AGENTS.md, the tracker guide and HANDOFF.md point to skill-integration.md. Human merge approval remains required. Production deployment, live migrations and real patient data require separate authorization. The independent protected-branch pre-push hook remains.

Previous board checks describe the retired setup, not the current workflow. No application verification or deployment was performed during removal. The foundation still needs real application checks.
