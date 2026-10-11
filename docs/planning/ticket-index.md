# Spec 001 — published implementation tickets

Current execution status: [delivery-status.md](delivery-status.md). ticket-publication.json is the original publication payload, not a live issue-status tracker. Native blocker links are retained even after their issues close.

Parent specification: https://github.com/aymanobeid0/clinic-app/issues/1

All 28 approved tickets are published with `ready-for-agent`. Native GitHub blocking relationships were verified for every ticket with blockers. Parent issue was not edited or closed. Planning IDs are not GitHub issue numbers.

| Plan ID | GitHub issue | Title | Blocked by GitHub issues |
|---|---|---|---|
| 1 | [#2](https://github.com/aymanobeid0/clinic-app/issues/2) | Define the selected stack's foundation and assess VPS constraints | None |
| 2 | [#3](https://github.com/aymanobeid0/clinic-app/issues/3) | Resolve identity, permissions, and historical-access contracts | None |
| 3 | [#4](https://github.com/aymanobeid0/clinic-app/issues/4) | Resolve financial contracts and document rules | None |
| 4 | [#5](https://github.com/aymanobeid0/clinic-app/issues/5) | Resolve clinical chart and prescription contracts | None |
| 5 | [#6](https://github.com/aymanobeid0/clinic-app/issues/6) | Resolve file handling and pilot data requirements | None |
| 6 | [#7](https://github.com/aymanobeid0/clinic-app/issues/7) | Bootstrap a clinic and sign in as its manager | [#2](https://github.com/aymanobeid0/clinic-app/issues/2), [#3](https://github.com/aymanobeid0/clinic-app/issues/3) |
| 7 | [#8](https://github.com/aymanobeid0/clinic-app/issues/8) | Manage staff accounts, permissions, and recovery | [#7](https://github.com/aymanobeid0/clinic-app/issues/7) |
| 8 | [#9](https://github.com/aymanobeid0/clinic-app/issues/9) | Register, find, and archive patients | [#8](https://github.com/aymanobeid0/clinic-app/issues/8) |
| 9 | [#10](https://github.com/aymanobeid0/clinic-app/issues/10) | Assign and share patients with scoped clinical access | [#9](https://github.com/aymanobeid0/clinic-app/issues/9) |
| 10 | [#11](https://github.com/aymanobeid0/clinic-app/issues/11) | Book and manage appointments and walk-in arrival | [#9](https://github.com/aymanobeid0/clinic-app/issues/9) |
| 11 | [#12](https://github.com/aymanobeid0/clinic-app/issues/12) | Maintain medical history and the manual dental chart | [#5](https://github.com/aymanobeid0/clinic-app/issues/5), [#10](https://github.com/aymanobeid0/clinic-app/issues/10) |
| 12 | [#13](https://github.com/aymanobeid0/clinic-app/issues/13) | Manage the procedure catalog and create a treatment proposal | [#4](https://github.com/aymanobeid0/clinic-app/issues/4), [#10](https://github.com/aymanobeid0/clinic-app/issues/10) |
| 13 | [#14](https://github.com/aymanobeid0/clinic-app/issues/14) | Present, accept, and revise treatment plans | [#13](https://github.com/aymanobeid0/clinic-app/issues/13) |
| 14 | [#15](https://github.com/aymanobeid0/clinic-app/issues/15) | Start visits and record work on planned procedures | [#11](https://github.com/aymanobeid0/clinic-app/issues/11), [#14](https://github.com/aymanobeid0/clinic-app/issues/14) |
| 15 | [#16](https://github.com/aymanobeid0/clinic-app/issues/16) | Autosave, finalize, and correct visit notes | [#15](https://github.com/aymanobeid0/clinic-app/issues/15) |
| 16 | [#17](https://github.com/aymanobeid0/clinic-app/issues/17) | Confirm chart updates and print manual prescriptions | [#12](https://github.com/aymanobeid0/clinic-app/issues/12), [#15](https://github.com/aymanobeid0/clinic-app/issues/15) |
| 17 | [#18](https://github.com/aymanobeid0/clinic-app/issues/18) | Provide revocable historical clinical access | [#12](https://github.com/aymanobeid0/clinic-app/issues/12), [#14](https://github.com/aymanobeid0/clinic-app/issues/14), [#16](https://github.com/aymanobeid0/clinic-app/issues/16), [#17](https://github.com/aymanobeid0/clinic-app/issues/17) |
| 18 | [#19](https://github.com/aymanobeid0/clinic-app/issues/19) | Upload and manage patient attachments within quota | [#6](https://github.com/aymanobeid0/clinic-app/issues/6), [#10](https://github.com/aymanobeid0/clinic-app/issues/10) |
| 19 | [#20](https://github.com/aymanobeid0/clinic-app/issues/20) | Show due procedure charges and documented opening balances | [#4](https://github.com/aymanobeid0/clinic-app/issues/4), [#15](https://github.com/aymanobeid0/clinic-app/issues/15) |
| 20 | [#21](https://github.com/aymanobeid0/clinic-app/issues/21) | Record deposits and manually settle procedure charges | [#20](https://github.com/aymanobeid0/clinic-app/issues/20) |
| 21 | [#22](https://github.com/aymanobeid0/clinic-app/issues/22) | Issue settled procedure invoices and whole-plan summaries | [#21](https://github.com/aymanobeid0/clinic-app/issues/21) |
| 22 | [#23](https://github.com/aymanobeid0/clinic-app/issues/23) | Correct payments, refund funds, and cancel charged treatment | [#22](https://github.com/aymanobeid0/clinic-app/issues/22) |
| 23 | [#24](https://github.com/aymanobeid0/clinic-app/issues/24) | Receive batches and review stock availability | [#8](https://github.com/aymanobeid0/clinic-app/issues/8) |
| 24 | [#25](https://github.com/aymanobeid0/clinic-app/issues/25) | Consume packs and record inventory corrections | [#24](https://github.com/aymanobeid0/clinic-app/issues/24) |
| 25 | [#26](https://github.com/aymanobeid0/clinic-app/issues/26) | Review daily operations, balances, and follow-up tasks | [#16](https://github.com/aymanobeid0/clinic-app/issues/16), [#23](https://github.com/aymanobeid0/clinic-app/issues/23), [#25](https://github.com/aymanobeid0/clinic-app/issues/25) |
| 26 | [#27](https://github.com/aymanobeid0/clinic-app/issues/27) | Export authorized clinic records and attachments | [#6](https://github.com/aymanobeid0/clinic-app/issues/6), [#18](https://github.com/aymanobeid0/clinic-app/issues/18), [#19](https://github.com/aymanobeid0/clinic-app/issues/19), [#23](https://github.com/aymanobeid0/clinic-app/issues/23), [#25](https://github.com/aymanobeid0/clinic-app/issues/25) |
| 27 | [#28](https://github.com/aymanobeid0/clinic-app/issues/28) | Rehearse deployment, backup, and restoration with fictional data | [#2](https://github.com/aymanobeid0/clinic-app/issues/2), [#6](https://github.com/aymanobeid0/clinic-app/issues/6), [#19](https://github.com/aymanobeid0/clinic-app/issues/19), [#21](https://github.com/aymanobeid0/clinic-app/issues/21), [#25](https://github.com/aymanobeid0/clinic-app/issues/25) |
| 28 | [#29](https://github.com/aymanobeid0/clinic-app/issues/29) | Validate and cut over the controlled clinic pilot | [#17](https://github.com/aymanobeid0/clinic-app/issues/17), [#18](https://github.com/aymanobeid0/clinic-app/issues/18), [#22](https://github.com/aymanobeid0/clinic-app/issues/22), [#23](https://github.com/aymanobeid0/clinic-app/issues/23), [#26](https://github.com/aymanobeid0/clinic-app/issues/26), [#27](https://github.com/aymanobeid0/clinic-app/issues/27), [#28](https://github.com/aymanobeid0/clinic-app/issues/28) |

Start frontier: issues #2, #3, #4, #5, #6. These prerequisite tickets require reviewed decisions/evidence; their ready-for-agent label does not resolve open choices. Implementation follows approved blockers.

The approved React/TypeScript, Express/TypeScript, PostgreSQL/Prisma, Docker/Nginx stack and supporting dependency baseline are included in the foundation ticket. Exact version compatibility and infrastructure feasibility remain prerequisites.
