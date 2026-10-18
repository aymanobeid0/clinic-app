# Local dev launcher independent review — 2026-10-18

Reviewer root; sole builder prescription_builder. Owner scope: “pull the changes to the local” and create a way to run the dev server after each round, followed by “continue.” No clinical ticket, production deployment, live migration or real data authorized.

Comparison base is merged main at execution start921b3faca47cc3515dbe17f297d93f23b6bbaca3, following the owner's existing main-at-start preference. Inspected git diff 921b3fa...HEAD and git log 921b3fa..HEAD --oneline. Runtime source8919d5f; final builder5ee55221b685419104823d5b881af591ea2115b1 changes only report/README punctuation afterward.

## Standards

Zero residual material findings. Reviewed all17 scoped files: fixed local Compose/owner/runtime URLs, RLS runtime assertion, local Docker endpoint validation/pinning, guarded separate dev entry, unchanged production server, public-HTTP seed, ignored mailbox/session/control artifacts, authenticated stop ownership, process cleanup, default Vite behavior, type/lint inclusion and Windows wrappers. Applied D:/clinic-app/.agents/skills/code-review/SKILL.md substantive standards/Fowler heuristics with one independent reviewer for both axes, per AGENTS/workflow override. No material abstraction/smell warranted a further finding.

## Spec

Zero residual material findings against the owner-approved local testing scope. First run installs/generates/migrates and provisions fictional accounts; persistent data survives restart; new commands preserve existing npm run dev and test ports. Preliminary review concerns were corrected by the same builder: Docker errors are actionable; stop-header validation cannot throw from differing byte lengths; remote Docker endpoints are refused; incomplete initial seed is detected rather than silently treated as complete. The README's original punctuation was restored after an encoding regression.

Existing partial setup is preserved and fails with explicit repair guidance; automatic destructive reset/reseed is intentionally absent. After a completed setup, user edits and passwords are not overwritten.

## Independent execution

Root directly verified Node24.13.0/npm11.6.2/Docker29.8.2 and free dev ports before startup. Root exercised actual HTTP through the Vite5173 proxy: all3 demo logins, assigned dentist/assistant views, manager clinical403, assistant absence of signing authority, and invalid private-control403. Root created a fictional patient, used the dedicated stop command, directly restarted the launcher in a hidden background process, and verified the created name remained through the public patient query. Initial manual harness expected200 for creation; corrected to the actual documented201. That was a reviewer harness error, not an application failure.

Root independently tested production mode, remote-Docker stop, mismatched direct dev database and duplicate launch. All rejected clearly, the active runner state remained byte-identical, and the app remained healthy. Evidence scripts: .local-dev/reviewer-smoke.mjs and reviewer-guards.mjs; runtime logs runner.stdout.log/runner.stderr.log are ignored local artifacts. Root left the app running at http://127.0.0.1:5173 for the owner.

Root directly read builder logs: API114/114 across11 files,237.21s; typecheck/lint/build passed. Those are builder executions, not root reruns. Builder separately verified edited-contact/revision persistence, clean shutdown of all four ports, default4173/3000 and overridden5173/3001 configuration, local guard behavior and26 fresh isolated test migrations. Exact provenance: local-dev-implementation.md and ignored .local-dev logs. Only the disposable test database was stopped after regression checks; persistent dev remains running.

## Limits and disposition

Windows lifecycle is exercised; Unix socket support is source-inspected, not cross-platform runtime certification. Local mailbox/session/recovery files follow local OS permissions and are for fictional use. An incomplete first seed needs explicit maintainer repair. Vite retains the existing521.55KB chunk warning. Full product browser suite was not rerun for this isolated dev harness; actual local HTTP behavior and existing full API regression were verified.

Standards0 / Spec0 residual material findings. Human review/manual merge remains required. Existing owner HANDOFF/design edits are unstaged and preserved.
