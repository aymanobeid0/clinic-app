# Delivery status

Last verified: 2026-10-25 UTC during documentation cleanup. This is a dated navigation summary, not a live tracker or new implementation authorization. Read the linked GitHub issues for current criteria, comments and native dependencies. The previous status text is retained in [the dated archive](delivery-status.history-2026-10-25.md).

| Scope | Directly verified status | Evidence |
| --- | --- | --- |
| Recovery reconciliation [#50](https://github.com/aymanobeid0/clinic-app/issues/50) | Closed/completed | [Reconciliation](recovery-reconciliation.md), [review](recovery-reconciliation-review.md) |
| Backend/API evidence gate [#51](https://github.com/aymanobeid0/clinic-app/issues/51) | Closed/completed | [Acceptance map and actual checks](issue-51-backend-acceptance.md), [review](issue-51-review.md) |
| Identity logic [#52](https://github.com/aymanobeid0/clinic-app/issues/52) | Issue open; [PR93](https://github.com/aymanobeid0/clinic-app/pull/93) merged | [Implementation](issue-52-implementation.md), [review](issue-52-review.md) |
| Patient/access/scheduling logic [#53](https://github.com/aymanobeid0/clinic-app/issues/53) | Issue open; [PR94](https://github.com/aymanobeid0/clinic-app/pull/94) merged | [Implementation](issue-53-implementation.md), [review](issue-53-review.md) |
| Clinical/attachment logic [#54](https://github.com/aymanobeid0/clinic-app/issues/54) | Closed/completed; [PR95](https://github.com/aymanobeid0/clinic-app/pull/95) merged | [Implementation](issue-54-implementation.md), [review](issue-54-review.md) |
| Treatment/catalog logic [#55](https://github.com/aymanobeid0/clinic-app/issues/55) | Issue open; [PR96](https://github.com/aymanobeid0/clinic-app/pull/96) merged | [Implementation](issue-55-implementation.md), [review](issue-55-review.md) |

PR96 merge: `695fcb1f7f0f407e14dfedb3b66ad140662b1c2c`, 2026-10-25 12:33:23 UTC. Open source issues above were not closed by this documentation task; merged evidence and issue state are distinct facts.

## Remaining delivery ownership

The approved sequence remains backend/API → separate frontend logic → components → pages → routing → main-app composition. See [reconciled source ownership](recovery-reconciliation.md) and the [published recovery index](recovery-ticket-index.md). Local ticket copies are publication snapshots; GitHub is authoritative for later edits and blockers.

- #56–#59 own the remaining frontend business-logic scopes; each needs explicit implementation authorization and current prerequisite verification.
- #60–#75 own designed components/pages/workflows; #76 owns connected coverage and scaffold retirement. The scaffold remains an internal verification consumer. Merged logic does not establish completed Dentara UI.
- #28/#29 retain separate operational/pilot gates. Bounded backend acceptance does not establish production readiness, live mail delivery, qualified clinical/legal approval, restore performance, physical capacity or real-patient authorization. See the specific limitations in the #51 evidence and approved topic contracts.

## Local development workspace

The owner-requested demo launcher/database/helpers were removed on 2026-10-19; [removal review](local-demo-removal-review.md) retains that history. Existing automated-test infrastructure remains; [README](../../README.md) documents its disposable database/port setup. Inspect actual resources before writes. This status page does not authorize recreating a manual demo, deployment or migrations.
