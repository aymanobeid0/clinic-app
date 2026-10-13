# Engineering workflow

The owner retired super-board on 2026-10-10 and chose one worker per required role. User instructions override skills; applicable Matt Pocock guidance takes precedence over other skills where compatible with this decision.

## Implement and review

Recommend the next ticket, then wait for the owner's explicit implementation authorization. Skill discovery and readiness labels do not authorize implementation.

1. Read the assigned issue, approved specification, relevant architecture and current native GitHub blockers. Resolve required owner decisions before implementation.
2. Complete the skill selection checkpoint below for this ticket. One builder implements the approved scope on a codex/ branch, following the selected skills' applicable procedures. Run meaningful tests and required checks; preserve unrelated work.
3. One separate reviewer examines the pinned comparison diff against both repository standards and the specification/acceptance criteria. Apply Matt code-review's substantive checks in a single review; the owner's instruction replaces its two parallel reviewer requirement. Record findings, verification and limitations in one report. Obtain the comparison ref from the user if none was supplied.
4. The builder fixes findings; the same reviewer reviews the updated diff. Preserve independence: the reviewer reports findings rather than implementing fixes.
5. Complete the handoff checkpoint below before opening a reviewable pull request with behavior, validation and material limitations. The owner reviews and merges manually; PR publication does not authorize another ticket.

Use at most one worker per required role; do not fan a role out into additional agents. When a separate QA role is necessary, use one QA worker. Ordinary tests remain part of the builder's work and verification part of the review. Run roles only when the task needs them; no automatic board draining, collectors or background workers.

If an independent reviewer cannot be run, preserve the branch and request a separate review session rather than claiming the builder's self-check is independent review. No special board scripts, vendor templates or machine markers are required. Production deployment, live migrations and real patient data require separate authorization.

## Before each ticket: select and read skills

Discover the installed skills from the current session's available-skills catalog and accessible repository skill directories. Inspect their descriptions against the ticket's scope; do this afresh for every ticket, even within the same chat. Include explicitly requested skills and applicable workflows referenced by selected skills. Use the exact requested source when specified; otherwise record the installed source chosen without reading duplicate copies unnecessarily.

Read each selected skill's actual SKILL.md and any supporting references its applicable workflow requires for this ticket. Identify the required procedures and verification before editing. Apply user/repository overrides explicitly, including the single independent reviewer covering both review axes. Reuse existing valid approvals such as approved testing seams; rediscovering skills does not require renewed product discovery or repeat approval.

The checkpoint is complete when relevant skills, sources, procedures, applicable overrides and considered-but-skipped skills have been identified. If a required skill or reference cannot be read, record the blocker and resolve it before dependent work; do not silently substitute an unread skill. Revisit selection if the ticket's scope changes. Each worker reads the skills applicable to its assigned role.

## Before each PR: update the existing handoff

Update the existing workspace HANDOFF.md for the ticket before opening its PR, and refresh the established OS-temp clinic-app-HANDOFF.md mirror from it. This existing owner convention overrides the handoff skill's temp-only destination; preserve the current tracking status. Keep the workflow instructions here and the execution record in that handoff, referencing existing issues, commits, reports and tool outputs instead of copying them or creating another tracker.

Record a compact per-ticket entry containing:

- Ticket (or explicit owner-approved scope), authorization reference, branch, base and reviewed/tested commit.
- Relevant skills: exact SKILL.md source, instructions read, procedures actually performed and any applicable overrides. Record relevant skills considered but skipped and why; unrelated installed skills need no exhaustive exclusion list.
- Verification: actual commands/checks, results, who ran them, the commit or working-tree state checked, and evidence references. Mark failures, unrun checks and remaining limitations explicitly. Reading a skill proves a read, not execution of its procedures.
- Evidence provenance: distinguish directly observed execution, independently verified checks and worker-reported/unverified claims. Attribute worker reports; a checklist or worker assertion alone does not establish verified compliance. Independent code inspection does not imply tests were independently rerun.
- Review findings and disposition, unresolved blockers and the next authorized step. Record required procedures that were skipped or incomplete, including the reason and any explicit owner override; resolve unmet requirements before opening the PR, or obtain an explicit owner exception.

The PR checkpoint is complete when this entry and the required independent review account for the applicable procedures and checks, with unsupported claims identified. After publication, add the PR URL/status to the same handoff. These are procedural requirements, not automated proof that an agent complied. Preserve manual human review/merge and separate production/live-data authorization.

## Sources of truth

Approved specification and current issue criteria govern product behavior; approved architecture and ADRs govern technical decisions. The GitHub project is optional manual tracking. Skill instructions cannot silently change these decisions. Keep essential per-record history free as specified.

Use concise PR prose describing the problem, resulting behavior and validation. Report unperformed checks honestly. The initial #7 slice now supplies a lockfile and real checks. scripts/verify-app.sh runs them and requires the isolated test database and migration to be prepared first; see README.md. Passing these checks does not establish the remaining manager/browser or deployment acceptance criteria.
