# Current handoff

Updated 2026-10-25 UTC. Earlier evidence: [history index](HANDOFF.history-2026-10-25.md).

## Owner direction and current scope

Prioritize usable delivery, minimal clear changes and proportionate tests/time/tokens. Reuse stable context; keep updates/evidence concise. Preserve required independent review and human merge approval. See [AGENTS.md](AGENTS.md) and [workflow](docs/agents/skill-integration.md).

Owner explicitly authorized this chat to implement #57 through checks, one independent reviewer/fixes/recheck and push/PR; standing publication authorization applies. No #58, automatic merge, production operation or real patient data. Final product UI remains deferred.

Branch `codex/issue-57-billing-logic`. Freshly fetched main/base and owner-selected comparison `b50448fe5a6bb815438ebf25b9cd75eafa370930` (owner approved fresh main for this ticket). Existing authorized instruction/tracking changes preserved separately in `df8a916`. Initial billing source `d08639c52a8f4e4925870166178076ac9f0113d5`; reviewed/fixed application source `bc0d8ecd0d26e272bf412567084b078da49b5118`.

## Delivery and evidence

#57 exposes scoped billing reads, RHF confirmed financial commands with unchanged uncertain retries, and individually authorized invoice/receipt/summary output. Reuses existing transport/query/lifetime mechanisms. No product components/pages/routes/backend/contracts/schema changes. Existing historical own-work financial snapshot remains read-only. Details and exact skill sources/procedures/overrides: [implementation report](docs/planning/issue-57-implementation.md).

Builder directly observed final affected browser17/17 PASS15.0s and typecheck/lint PASS at fixed source. Final build passed; bundle advisory542.62kB/157.64kB gzip remains. One independent reviewer `/root/reviewer57` found one Standards/P3 and two Spec/P2 issues; builder reproduced/fixed them and same-reviewer recheck accepted fixed source with zero residual findings. Reviewer independently reran billing7/7 PASS5.8s. See [review](docs/planning/issue-57-review.md). Final full Vitest259/259 (26files) PASS499.56s, EXIT0 at unchanged fixed source, then build/diffcheck/source-identity PASS. Exact source/time/output evidence in implementation report. Same reviewer accepted final evidence checkpoint `7915d6801a3a3799cfa33d84e9026d4094872a17`, directly inspecting full-suite output/source and matching actual mirror. No PR published yet.

Known integration limitation: no billing-specific backend SSE. Existing clinic stream is used only for permitted patients.read/manager scopes; other financial readers have Query focus/reconnect and own-command refresh. Every output reauthorizes at the server. Designed UI belongs to #69/#70/#75 and connected integration/scaffold retirement to #76; operational/legal/provider/pilot gates remain separate.

## Tracker and safety

Direct live #57 is OPEN, no comments, native dependency #53 CLOSED; Project status Building. #50–#56 closed/completed after merged evidence reconciliation (PR93/94/98 included). Do not treat old open states as missing implementation. Move #57 to Review upon PR publication; close/Done only after owner-approved merge and scope/evidence verification.

Owner issue7 database remains stopped on55437. Only disposable `clinic-issue57-test` created on verified free loopback55438; project labels/binding/no mounts inspected before existing38 migrations and again after checks. It was removed after all tests; owner issue7 remains stopped/untouched. Preserve manual/Apidog resources. No ignored credentials read. Git/network/browser sandbox limitations were retried through supported escalation successfully; no current connection blocker.

Preserve excluded, untracked, planned-only `docs/planning/api-validation-errors-plan.md`: SHA256 `82E186AF080DB25098E44EEA1B9B097122245C0447967E1D4827528162E64A6A`. Existing actual mirror: `C:/Users/ayman/AppData/Local/Temp/clinic-app-HANDOFF.md`; refresh and hash-compare before PR.

Next authorized steps: push/open/attach PR for human review under standing authorization. Suggested skills: existing Matt implement/TDD/reviewer and handoff/PR guidance; reuse this ticket's completed reads.
