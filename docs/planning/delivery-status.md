# Current delivery status

As of 2026-10-13 (Africa/Bamako). Approved specifications/contracts govern behavior; this document records execution status. Machine-readable companion: delivery-status.json.

Planning #2–#6 are closed with owner approval. PR #35 merged the complete #7 login contract; #7 is closed. Earlier PR #32/#33/#34 and amendment delivery notes are historical snapshots. #8 is the authorized next issue on codex/issue-8-accounts, based on b8dc3b5. Native prerequisites are satisfied. No super-board workflow is active.

#8 implements individual doctor/staff identities, permission configuration, manager promotion retaining login, requested username/reset workflows, personal password changes, offline/email manager recovery and session invalidation. Functional French forms are implemented; visual design remains owner-deferred. Common identity authorization and transaction-scoped actor/target decisions preserve the approved Routes -> Controller -> Service -> Repository structure. Loaded revisions detect stale administration edits. See issue-8-implementation.md for behavior, actual verification and limits; independent review is pending.

Remaining gates: independent review followed by human PR review/merge; actual transactional mail delivery/provider/sender; Linux/native runtime; ingress/secure cookies; provider/host evidence; backup capacity/cost and restore rehearsal; qualified clinical/legal/real-data handling. Patient/files/financial endpoint scopes and affected operational stream termination remain subsequent feature work. No production deployment, live migration or patient-data authorization exists.

Historical discovery/review files and ticket-publication.json are dated snapshots rather than live tracker substitutes. Preserve unrelated root design relocations/AGENTS/HANDOFF changes. Dependency versions remain unchanged.

Independent #8 review completed against b8dc3b5 on implementation64335cb: zero residual material standards/spec findings, reviewer independently reran10 account HTTP tests successfully. See issue-8-review.md. Human-reviewed PR publication/merge remains pending; #8 is not closed.

Publication: open PR #36 https://github.com/aymanobeid0/clinic-app/pull/36; independent review passed, issue/project #8 is in Review. Human approval/merge and issue acceptance remain pending. No merge or production action performed.
