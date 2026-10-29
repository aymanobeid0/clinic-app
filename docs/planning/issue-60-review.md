# Issue 60 — independent combined review

Reviewer: the one separate reviewer, 2026-10-29. Builder remains the root agent. No reviewer source fixes or additional agents.

Comparison: `git diff 90f1fc5b51dfaa43090ce13d92c1bf0ffcc07f26...0c3ee1d`; commit list initially contains `0c3ee1d feat(web): build scoped clinic workspace and authentication UI (#60)`. The comparison is the merged-main/PR111 base supplied with the task. Its diff is nonempty.

Read for this role: repository `AGENTS.md`, `HANDOFF.md`, `docs/agents/skill-integration.md`, `docs/agents/issue-tracker.md`, `.agents/skills/code-review/SKILL.md`; current GitHub #60 body/comments (OPEN, no comments); relevant Spec001, identity amendment, architecture and approved `D:/clinic-visual-system/README.md`/`AGENT-HANDOFF.md`, tokens and component contracts. The old visual design is superseded. Applied the skill's standards and specification checks and complete Fowler smell baseline in one reviewer; owner instruction overrides its two-agent fanout. TDD/implementation skills are builder responsibilities; review adds no product discovery or new testing seam.

## Standards

Initial inspection: no hard standards finding or actionable baseline smell. Query/RHF/React/Zustand ownership and existing feature APIs are preserved. The retained scaffold consumer/configuration does not delete the original presentation or claim #76 acceptance. Owner local documentation changes are excluded. Tool-enforced formatting/type issues are not counted as smell findings.

## Spec

1. **P1 — ready-account password change uses the temporary-password endpoint.** At `0c3ee1d`, `Settings.tsx` renders `PasswordForm` with `session.replacePassword`. This collects only a new password and calls `/api/onboarding/password`; the backend's `replaceTemporaryPassword` rejects a ready account without `temporaryExpiresAt` with409. The ready-account contract instead requires current-password-confirmed `/api/password`, followed by session revocation/re-authentication. This violates #60's working visible controls/current identity contract. Reuse the existing personal-settings behavior and prove a real password-change journey. The initial live test title mentions password change but its body only changes the initial temporary password, visits preferences and signs out.

2. **P2 — sidebar icon style does not implement the explicit outline-icon criterion.** At `0c3ee1d`, `App.tsx` mixes Unicode `▦` and `⚙`; these inherit platform font rendering and unrelated stroke weights. #60 expressly requires consistent outline icons. Replace with one coherent outline treatment without adding an unnecessary dependency.

Enlarged-text/short-desktop layout and final preview/specimen comparison remain verification items, not asserted defects. The placeholder historical-access landing is explicitly limited to shared role-start ownership; #75 retains historical-record views. Detailed report/export/follow-up actions remain #73, so this review does not count their absence as #60 scope loss.

## Independently observed checks

At `0c3ee1d`, ran `npx playwright test --config playwright.workspace.config.ts workspace.spec.ts` from `apps/web` through supported elevated localhost access: **11/11 PASS,13.4s**. These are rendered HTTP-boundary mocked cases, covering login layout stability, permissions and historical exclusion, direct routes/refresh/back-forward, failure/large exact amounts, restricted setup, four viewport widths and recovery-link capture. No real-persistence, full suite or build was independently rerun; builder results remain builder evidence. No relevant source edits occurred during that run.

Initial summary: Standards0; Spec2 (worst P1). Recheck pending builder fixes and final delivery/visual evidence; this is not a publication pass.

## Same-reviewer source recheck — 80d7d74

Compared corrected source `80d7d741cd3a7c4cc0e9efd0b3a57be987967774` against the same base and inspected the fix diff from `0c3ee1d`.

- P1 resolved: `PersonalSecurity` uses the feature-owned `usePersonalSettings`/existing `useSelfSettings` behavior, collecting current and new passwords and sending `/api/password`. Successful change refetches identity so the existing scope workflow clears sensitive queries and returns to re-authentication. The revised real journey now changes a ready account's password and signs in with its replacement; its execution remains builder evidence.
- P2 resolved: both sidebar icons use the same SVG20px/1.5 stroke outline treatment.
- Follow-up inspection of the newly bound email controls: ready accounts render `verifyOnly`, so no setup-only send action is exposed; captured verification links route to personal preferences. The email section supports managers and retained email-login accounts after demotion; code regeneration remains manager-only.
- The fixed-height identifier reservation was changed to a minimum-height grid with content growth. Independently inspected builder screenshot artifacts `issue-60-login-desktop.png`, `issue-60-login-mobile.png` and `issue-60-login-zoom.png` in the current dated visualization directory. Desktop screenshot1440×768 fits; form-left/panel-right and centered visual content follow owner preferences. Mobile controls are readable, and enlarged capture retains distinct inputs and permits extra document height. Pale canvas, Inter, primary/inverse colors and control geometry follow the approved component specimens; borderless application content intentionally follows the owner override. This is specimen/token comparison, not a nonexistent page-reference match.

Independently reran `npx playwright test --config playwright.workspace.config.ts workspace.spec.ts`: **14/14 PASS,11.1s**, at `80d7d74`; includes the ready-password payload/error case, ready-email link controls and short-desktop/enlarged-text regression. `git diff --check 90f1fc5...80d7d74` PASS. No browser/API/DB preview service was modified; review test runner released4188.

Additional compatible React review source read: `C:/Users/ayman/.codex/plugins/cache/openai-curated-remote/build-web-apps/0.1.2/skills/react-best-practices/SKILL.md`, with `rules/rerender-derived-state-no-effect.md` and `rules/bundle-barrel-imports.md`. Existing Query state and direct local imports take precedence over inappropriate Next/SWR examples; no additional performance refactor is justified.

Residual source findings: **Standards0; Spec0**. Final delivery documentation/preview evidence checkpoint remains pending; full-suite/live/build results are builder-reported, not independently rerun by this reviewer. No production, live email or real-patient acceptance follows.

## Final source/evidence checkpoint — 9e2770a

Reviewed `9e2770a59cd8caf4e6e16ba76b7282b0dbbfceea` against base `90f1fc5b51dfaa43090ce13d92c1bf0ffcc07f26`, the implementation report and current tracked `HANDOFF.md` update. Since independently tested `80d7d74`, the only application change is replacing raw patient UUID labels with overview copy in two follow-up rows. No redundant test rerun is justified for those text-only changes. Final comparison whitespace check PASS.

Independently inspected `issue-60-dashboard-desktop.png` and `issue-60-dashboard-mobile.png` in the same dated visualization directory. The desktop blue and mobile teal views show three fictional appointments, an empty financial projection, one follow-up and stock summaries, with consistent readable typography, outline navigation, borderless surfaces and responsive stacking. The mobile menu is open and its working destinations remain visible. These are builder-captured screenshots inspected by the reviewer; the reviewer did not independently seed/query the preview or rerun the authenticated live case. Builder-provided preview is4190 with task API3188 and fictional-only database55446, explicitly retained for owner review.

The delivery report maps #7/#8/#26 behavior, #60 appearance/auth/shell/dashboard, and remaining #66/#73/#74/#75/#76 ownership without claiming unfinished pages or production acceptance. It records skill sources/overrides, the initial infrastructure-only test stall, real red/green fixes, actual test commands/results, independent versus builder provenance, preview resources and limitations. Handoff contains authorization/base/source pins, evidence pointers, reviewer disposition pending this checkpoint, owner preview and task-only cleanup instructions, preserved local files, and manual merge/next-ticket boundaries. Builder must refresh its final disposition/publication pointers and OS-temp mirror after this review update; that mechanical metadata refresh does not require a new implementation review.

Builder evidence, not independent execution:15/15 final browser cases (14 mocked plus1 real API/PostgreSQL), type/lint/build PASS, full Vitest287/287 in27 files640.74s. The reviewer read the full-suite log's final passing summary and independently rechecked all four preserved owner-document hashes against the implementation report; they match. This log inspection corroborates the recorded output and does not imply independent rerun. No unresolved service blocker is recorded; sandbox retries and task resource ownership are documented.

**Final disposition: Standards0 residual findings; Spec0 residual findings. Both initial findings are resolved. The combined independent review and delivery-evidence checkpoint pass for human-reviewed PR publication.** Human approval is still required for merge. Owner visual acceptance, later pages, production, live mail and real-patient use are separate.

## Same-reviewer Radix amendment — f81648a

Owner-approved follow-up within #60/PR112: adopt Radix Primitives for compound accessible controls while retaining the approved visual system. Compared `9567b0f685b104c9a0042fc3d36fb95e6ef210a8...f81648a80f7a23c70d27f3dc38981dbc599b99a9`; whole-PR base remains `90f1fc5`. Read the amended architecture/dependency policy, actual manifest/lock diff, login composition/CSS/tests, implementation follow-up and pending HANDOFF amendment. Reused this ticket's already-read review/React guidance; no additional worker or source fixes.

### Standards

No findings. Exact direct dependency `@radix-ui/react-tabs`1.2.1 is used by the delivered login; native controls, tokens and existing feature/session/query/form ownership remain. Independent parsed-lock comparison confirms no existing version/integrity/resolved-package change or removal. In addition to the web-workspace dependency, the existing `@types/react-dom` and `jiti` entries have npm peer/dev classification changes only;30 package paths are newly added for the primitive graph. The installed Radix package metadata admits the pinned React19 stack. Inspected its shipped code to confirm tab triggers are native `type=button` and panel/list roles are supplied. `git diff --check 9567b0f..f81648a` PASS.

### Spec

No findings. RHF still controls the login method and owns credential inputs; Radix supplies automatic tab activation, roving focus and labelled panels. Inactive fields unmount; the registered method input remains mounted and password/submit controls remain shared. The styles target active primitive state and maintain the reserved identifier grid. The policy accurately adopts Primitives, not Themes, and requires future composition checks without inventing a wrapper framework or new product scope.

Independent execution at `f81648a`: `npx playwright test --config playwright.workspace.config.ts workspace.spec.ts` from `apps/web` **15/15 PASS,11.9s**. This includes ArrowRight/Home, selected tab and panel labels, stable password placement, four widths, keyboard validation, enlarged text and existing permission/routing/failure cases. Test runner released4188. An additional independent browser-boundary probe against4190 intercepted all API requests (no real-data writes) and submitted both panels: exact email versus clinic/username payloads matched, inactive required fields did not block submission, and runtime pageerrors were empty. This probe tests public rendered/form/HTTP behavior, not RHF internals.

Independently inspected `issue-60-radix-login.png`: desktop appearance remains consistent with the previously reviewed token-based login; no clipping/layout regression visible. Actual fictional manager/doctor API sign-in checks, identity Vitest6/6, type/lint/build and audit comparison remain builder evidence, not independently rerun. The new503.58KB chunk advisory and pre-existing audit findings are explicitly recorded; neither is represented as resolved. Repeating the roughly11-minute backend/fault-injection suite would not exercise this React-only amendment and would disrupt the retained preview, so focused coverage follows the owner's execution-economy instruction. Earlier287/287 remains earlier evidence.

**Radix amendment disposition: Standards0; Spec0. Same-reviewer checkpoint PASS at `f81648a80f7a23c70d27f3dc38981dbc599b99a9`.** Update HANDOFF's pending status/source pin and its OS-temp mirror before publishing the amendment to PR112. No fresh approval is needed for that mechanical metadata update. Human merge and further UI/production/data authorizations remain separate; preview4190/API3188/database55446 were left running unchanged.

## Owner-requested login-spacing correction — 54e49d0

After owner merge of PR112, the owner requested reducing excessive login field spacing. New explicit scope/branch `codex/login-spacing`; fixed comparison `git diff 69e6a01e88fb50770ae5de12c937615bba1a4ab5...54e49d09fe2dd83561cc89d0f6639f444312943c`. The implementation report records verified merge/closed issue/Done reconciliation; this correction requires a new human-reviewed PR, not an update to merged112 or reopening60. Same sole reviewer, no fanout or source fixes. Reused unchanged applicable repository review/React instructions; no new domain decision or testing seam.

### Standards

No findings. The small class/CSS change removes the fixed176px/two-row reservation and arranges the two team identifiers in one row; email spans that row. It reuses semantic spacing and retains native form controls, Radix composition and existing business/state ownership. The focused browser regression exercises observable rendered geometry rather than internal React behavior. `git diff --check 69e6a01...54e49d0` PASS. No backend/dependency/service change.

### Spec

No findings. Inspected `login-spacing-fixed-desktop.png`, `login-spacing-fixed-team.png` and `login-spacing-fixed-mobile.png` in the established external visual directory. The large blank email-field reservation is removed; desktop email/team layouts keep the same password/submit placement, with readable labels and compact controls. The320px team screenshot keeps both identifier fields available, clear focus on the selected tab and no visible overlap. Token identity, left/right desktop arrangement and mobile content remain consistent. Earlier token/layout review did not constitute owner approval of the field density; this correction follows the owner's later visual feedback.

Independently reran `npx playwright test --config playwright.workspace.config.ts workspace.spec.ts` from `apps/web` at `54e49d0`: **16/16 PASS,13.1s**, including compact input-to-password gap, equal team-input rows, stable tab switching, Radix keyboard/panel relationships, four viewport widths and enlarged-text accessibility. The test runner released4188. Builder's observed red132px→green43.5px measurement and type/lint/build PASS (existing503.60KB warning) remain builder evidence; reviewer independently confirms the regression's <=56px condition and rendered screenshots. Full backend regression remains prior evidence; repeating it for two presentation files would add no relevant behavior proof and would interfere with the retained preview.

Checked the correction section of the implementation report and rewritten current HANDOFF; they preserve scope/base/merge state, resource ownership, independent-check provenance and new-PR/manual-merge boundaries. Builder must replace their pending review status with this result, record final publication and refresh the OS-temp mirror. Those metadata updates require no further implementation recheck.

**Correction disposition: Standards0; Spec0. Independent source/evidence checkpoint PASS at `54e49d09fe2dd83561cc89d0f6639f444312943c` for publishing the authorized new correction PR.** Human merge remains required. Existing preview4190/API3188/database55446 were left unchanged; no subsequent ticket or live-data/production work is authorized.
