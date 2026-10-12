# Engineering workflow

The owner retired super-board on 2026-10-10 and chose one worker per required role. User instructions override skills; applicable Matt Pocock guidance takes precedence over other skills where compatible with this decision.

## Implement and review

1. Read the assigned issue, approved specification, relevant architecture and current native GitHub blockers. Resolve required owner decisions before implementation.
2. One builder implements the approved scope on a codex/ branch, using Matt implement and tdd when applicable. Run meaningful tests and required checks; preserve unrelated work.
3. One separate reviewer examines the pinned comparison diff against both repository standards and the specification/acceptance criteria. Apply Matt code-review's substantive checks in a single review; the owner's instruction replaces its two parallel reviewer requirement. Record findings, verification and limitations in one report. Obtain the comparison ref from the user if none was supplied.
4. The builder fixes findings; the same reviewer reviews the updated diff. Preserve independence: the reviewer reports findings rather than implementing fixes.
5. Open a reviewable pull request with behavior, validation and material limitations. Every merge requires human approval.

Use at most one worker per required role; do not fan a role out into additional agents. When a separate QA role is necessary, use one QA worker. Ordinary tests remain part of the builder's work and verification part of the review. Run roles only when the task needs them; no automatic board draining, collectors or background workers.

If an independent reviewer cannot be run, preserve the branch and request a separate review session rather than claiming the builder's self-check is independent review. No special board scripts, vendor templates or machine markers are required. Production deployment, live migrations and real patient data require separate authorization.

## Sources of truth

Approved specification and current issue criteria govern product behavior; approved architecture and ADRs govern technical decisions. The GitHub project is optional manual tracking. Skill instructions cannot silently change these decisions. Keep essential per-record history free as specified.

Use concise PR prose describing the problem, resulting behavior and validation. Report unperformed checks honestly. Application verification is unavailable until the foundation adds real scripts and a lockfile; scripts/verify-app.sh intentionally fails before then.
