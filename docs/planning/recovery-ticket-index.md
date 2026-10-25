# Spec 002 — published recovery ticket index

> Published planning snapshot (2026-10-18). Tables and local `recovery-r*.md` copies preserve original planning. Read each linked GitHub issue for current acceptance criteria, comments and native blockers; read [delivery status](delivery-status.md) for the dated progress summary.

Parent: [#49](https://github.com/aymanobeid0/clinic-app/issues/49). Owner approved the breakdown and specified the frontend architecture: business logic → components → pages → app routing → main app.

Approved execution sequence: backend/API first, then presentation-independent frontend business logic. No product UI coding is authorized by ticket publication. R11–R27 are deferred and require separate implementation authorization after the preceding gates. Keep backend authoritative rules and permissions on the server; clean frontend architecture does not mean copying database/repository layers into the browser.

R1–R2 establish preservation/reconciliation and the backend gate. Existing #18–#27 retain their scope/history; their backend acceptance evidence can satisfy R2 while their outstanding UI criteria remain mapped to later tickets. Do not require whole-issue closure as a backend gate because that would create a cycle. Existing #28/#29 remain operational/pilot gates, not replacements for frontend acceptance. Parent issues are not modified by this publication.

| Plan ID | Issue | Delivery | Blocked by |
|---|---|---|---|
| R1 | [#50](https://github.com/aymanobeid0/clinic-app/issues/50) | Reconcile recovery requirements and preserve a baseline | None |
| R2 | [#51](https://github.com/aymanobeid0/clinic-app/issues/51) | Verify the completed backend/API | #50, backend evidence #18, backend evidence #19, backend evidence #20, backend evidence #21, backend evidence #22, backend evidence #23, backend evidence #24, backend evidence #25, backend evidence #26, backend evidence #27 |
| R3 | [#52](https://github.com/aymanobeid0/clinic-app/issues/52) | Separate identity, session and account business logic | #51 |
| R4 | [#53](https://github.com/aymanobeid0/clinic-app/issues/53) | Separate patient, assignment and appointment business logic | #52 |
| R5 | [#54](https://github.com/aymanobeid0/clinic-app/issues/54) | Separate clinical record and attachment business logic | #53 |
| R6 | [#55](https://github.com/aymanobeid0/clinic-app/issues/55) | Separate treatment plan and catalog business logic | #54 |
| R7 | [#56](https://github.com/aymanobeid0/clinic-app/issues/56) | Separate visit, note and prescription business logic | #55 |
| R8 | [#57](https://github.com/aymanobeid0/clinic-app/issues/57) | Separate billing business logic | #53 |
| R9 | [#58](https://github.com/aymanobeid0/clinic-app/issues/58) | Separate inventory business logic | #52 |
| R10 | [#59](https://github.com/aymanobeid0/clinic-app/issues/59) | Separate report, follow-up and export business logic | #56, #57, #58 |
| R11 | [#60](https://github.com/aymanobeid0/clinic-app/issues/60) | Build the Dentara shell, dashboard and authentication pages | #59 |
| R12 | [#61](https://github.com/aymanobeid0/clinic-app/issues/61) | Build the patient list and profile pages | #60 |
| R13 | [#62](https://github.com/aymanobeid0/clinic-app/issues/62) | Build patient assignment and sharing workflows | #61 |
| R14 | [#63](https://github.com/aymanobeid0/clinic-app/issues/63) | Build medical history and dental chart pages | #62 |
| R15 | [#64](https://github.com/aymanobeid0/clinic-app/issues/64) | Build treatment proposal, version and acceptance pages | #63 |
| R16 | [#65](https://github.com/aymanobeid0/clinic-app/issues/65) | Build appointment and arrival pages | #61 |
| R17 | [#66](https://github.com/aymanobeid0/clinic-app/issues/66) | Build visit and clinical note pages | #64, #65 |
| R18 | [#67](https://github.com/aymanobeid0/clinic-app/issues/67) | Build prescription and chart-confirmation workflows | #66 |
| R19 | [#68](https://github.com/aymanobeid0/clinic-app/issues/68) | Build patient attachment workflows | #64 |
| R20 | [#69](https://github.com/aymanobeid0/clinic-app/issues/69) | Build charges, deposits and settlement pages | #66 |
| R21 | [#70](https://github.com/aymanobeid0/clinic-app/issues/70) | Build invoice, summary and financial correction pages | #69 |
| R22 | [#71](https://github.com/aymanobeid0/clinic-app/issues/71) | Build inventory receiving and availability pages | #60 |
| R23 | [#72](https://github.com/aymanobeid0/clinic-app/issues/72) | Build inventory consumption and correction pages | #71 |
| R24 | [#73](https://github.com/aymanobeid0/clinic-app/issues/73) | Build report, follow-up and export pages | #67, #68, #70, #72 |
| R25 | [#74](https://github.com/aymanobeid0/clinic-app/issues/74) | Build administration and reference catalog pages | #60 |
| R26 | [#75](https://github.com/aymanobeid0/clinic-app/issues/75) | Build the restricted historical workspace | #63, #64, #66, #67, #70, #74 |
| R27 | [#76](https://github.com/aymanobeid0/clinic-app/issues/76) | Retire the scaffold and verify the connected application | #61, #62, #63, #64, #65, #66, #67, #68, #69, #70, #71, #72, #73, #74, #75 |

At publication, all new tickets carried ready-for-agent; that label is preparation, not implementation authorization. Native links represent new recovery-ticket dependencies; existing-feature backend evidence dependencies are explicit in R2, rather than cyclic whole-issue closure requirements. Every new page must consume the separate logic layer, follow approved Dentara references, and be demonstrated locally before proceeding to further pages. Publishing does not authorize implementation, deletion, deployment, real patient data or merge.

