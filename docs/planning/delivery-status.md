# Current delivery status

As of 2026-10-14 (Africa/Bamako). Approved contracts govern behavior. Existing machine-readable companion: delivery-status.json.

Planning #2–#6 are owner-approved and closed. #7/#8/#9 are closed after manually merged PRs #35/#36/#38. Workflow PR #37 is merged. Current main09fa41c contains those changes. Older planning/publication notes are dated snapshots; no super-board workflow is active.

#10 is authorized on codex/issue-10-patient-access. Explicit multi-doctor/permitted-staff assignment/sharing/removal, scoped personal selection, immutable dated access history and French recovery/concurrency journeys are implemented. The public identity clinical transaction interface checks current readiness, eligibility, capability and active patient grant together with consuming work. Non-doctor managers are denied; doctor-managers require capability plus patient scope. Clinical content/endpoints are deliberately retained for their originating tickets under the owner's delegated boundary decision.

Independent review against main09fa41c through1d7dd68 found zero residual material standards/spec findings for that scope; root independently reran eight application tests successfully17.29s and checked the pinned diff. Builder full HTTP45/six files passed on40c76b8; after the readable-history projection correction, affected eight API tests,13 Chromium journeys, typecheck/lint/contracts-API-web builds passed. Other37 HTTP tests were not rerun after that correction. Full suites/builds remain attributed builder evidence. See issue-10-implementation.md and issue-10-review.md.

PR publication is next; #10 remains open pending human review/merge. No next ticket is authorized. Actual clinical content HTTP/documents/SSE integrations, historical cutoff/version selection (#18), production ingress, live mail, performance/load, backup restoration and qualified clinical/legal/real-data handling remain separate gates. No production deployment, live migration, real patient data or live email authorization exists. Dependencies and unrelated root edits are preserved.
