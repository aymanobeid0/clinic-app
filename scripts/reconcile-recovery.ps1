param([switch]$Publish)
$ErrorActionPreference = 'Stop'
$repo = 'aymanobeid0/clinic-app'
$snapshotPath = '.local-dev/reconciliation/issues-before.json'
$snapshot = Get-Content -LiteralPath $snapshotPath -Raw | ConvertFrom-Json
$mapping = Get-Content docs/planning/recovery-reconciliation-map.json -Raw | ConvertFrom-Json
$destination = '.local-dev/reconciliation/proposed'
New-Item -ItemType Directory -Force $destination | Out-Null
$backendCriteria = @{
  18 = @('Historical grants select permitted clinical and attachment versions at the accepted removal cutoff, excluding later entries and later edits to older records.', 'Apply the approved Q31b exception: read-only financial snapshots for the doctor''s own performed work through the cutoff only; redact or deny unauthorized/mixed content. No other doctors'' finances or later financial changes.', 'Deny historical mutations, operational access and application print/download/export; allow only authorized inline attachment snapshots. Manager revocation/account restrictions take effect on direct requests and affected streams.')
  19 = @('Authorized users upload/view PDF, JPEG and PNG with content validation, at most 20,000,000 bytes per file and 2,000,000,000 bytes per clinic, counting every retained version.', 'Reserve quota atomically; deny only uploads/replacements that exceed it, retain existing authorized file/core access, and release failed reservations without orphan publication.', 'Separate clinical/financial/mixed action and content permissions; guessed identifiers and historical routes never bypass scope. Reasoned logical removal/version replacement retain protected references/history and bytes; signed plan-acceptance evidence links through authorized API operations. No ordinary permanent deletion.')
  20 = @('Accepted unstarted procedures have planned amounts, not debt. Starting a procedure and creating its full agreed charge commit atomically exactly once, including retried starts.', 'Documented opening balances require provenance and create no fabricated historical payments.', 'Queries separate planned/due/credit and reconcile accepted price adjustments without rewriting protected history, under current actor/patient/own-work scope.')
  21 = @('Support manager-configurable payment methods, explicit deposits/excess entries and manual allocations using new money, existing credit or both.', 'Retained numbered receipt data/output distinguishes new funds from previously received credit; balances and separate deposit entries reconcile.', 'Atomic concurrent/retried commands cannot overspend credit, duplicate receipts or duplicate receipt of funds; enforce current financial permissions and currency precision contracts.')
  22 = @('Permit explicit manual whole-procedure invoice issue only for completed fully paid procedures, with unique numbering and no duplicate charge-bearing issue.', 'Retained invoice data and authorized reprint output keep identity/content, omitting installment breakdown while receipts retain payment details.', 'Completed-plan summary data/output includes procedures, paid/due totals and invoice references without introducing duplicate debt. Apply current document/financial authorization.')
  23 = @('Authorized reasoned refunds, reversals and credit adjustments follow approved allocation and post-settlement contracts; treat returning money and correcting entries as distinct actions.', 'Partial-care cancellation explicitly records the final charge and necessary adjustment, without automatic refund or removal of performed care.', 'Preserve issued documents, allocations and financial/clinical history; reports can reconcile adjustments. Enforce current permissions, retries and concurrent mutation safety.')
  24 = @('Authorized APIs maintain items and suppliers and receive whole packs by batch with quantity, cost and expiry where applicable; no fractional conversions or procurement accounting.', 'Read projections expose real batch availability, item low-stock thresholds and clinic expiry-warning settings within authorized scope.', 'Specify/test expiry date boundaries and permission checks for reads, settings and receiving; retain receiving history and retry/concurrency integrity.')
  25 = @('Authorized staff select a batch and consume a whole pack on opening; reject fractional consumption.', 'Waste, disposal and count corrections are explicit reasoned movements preserving immutable history.', 'Atomically block expired consumption and concurrent negative stock; retry cannot duplicate movements. No treatment-visit linkage is introduced.')
  26 = @('Authorized projections provide daily appointments, invoice/payment activity, outstanding balances and low/expiring stock reports.', 'Reconcile new money, applied credit, opening balances and adjustments separately; unstarted treatment is not debt, and aggregates enforce current patient/own-work restrictions.', 'Expose in-app follow-up task behavior and manually shareable authorized content without automatic delivery or advanced BI; include pending-note tasks and safe failure/retry handling.')
  27 = @('Authorized APIs export supported records/documents and attachments as approved CSV/JSON/private ZIP+manifest, preserving relationships, versions and checksums as specified.', 'Apply current clinical/financial/mixed content rules and own-work scope; non-doctor managers gain no clinical access and historical accounts cannot export. Recheck authorization during generation and before delivery.', 'Financial/stock histories reconcile to persisted records; bundles exclude secrets, stay private, expire and are cleaned separately from upload quota. Revocation and job failures cannot expose unauthorized outputs.')
}
$plan = @()
foreach ($map in $mapping) {
  $original = $snapshot | Where-Object number -EQ $map.number | Select-Object -First 1
  $logicLinks = ($map.logic | ForEach-Object { "#$($_) (https://github.com/$repo/issues/$_)" }) -join ', '
  $uiLinks = ($map.ui | ForEach-Object { "#$($_) (https://github.com/$repo/issues/$_)" }) -join ', '
  $header = @"
## Current recovery contract — 2026-10-18

Delivery order is governed by https://github.com/$repo/issues/49 and the owner's subsequent clarification: backend/API → separate frontend business logic → components → pages → app routing → main-app composition. Product behavior remains governed by Spec 001 and approved owner amendments. The original text below is retained as historical lineage, not an instruction to build all layers now.

No new product UI coding during backend or frontend-logic stages. No deletion, automatic progression, merge, deployment or real patient data is authorized by this reconciliation or a ready-for-agent label. A conflicting rule or unmet prerequisite blocks the affected implementation until resolved; do not guess. Each implementation requires specific owner authorization.
"@
  if ($map.number -le 17) {
    $current = @"
## Delivery status and remaining ownership

This issue remains closed as a historical implementation record. Its closure and scaffold browser tests do not certify the approved Dentara product UI or clean separation of frontend logic. Existing application/API evidence remains in the linked implementation/PR history; this reconciliation does not rerun or newly certify that backend behavior.

- Frontend business-logic ownership: $logicLinks.
- Outstanding designed UI/workflow ownership: $uiLinks. Shared authentication/navigation belongs to #60 and final coverage verification to #76.
- Preserve implemented behavior and useful tests. Do not repeat this feature wholesale or regard closed status as UI acceptance. The new tickets must verify the relevant original requirements, including documents and failure/access states.

Original dependencies describe historical implementation order; they are retained as history, not new blockers from this closed issue to its replacement UI. Backend-wide verification remains #51.
"@
    $nativeAdds = @()
  } elseif ($map.number -le 27) {
    $criteriaLines = ($backendCriteria[[int]$map.number] | ForEach-Object { "- [ ] $_" }) -join "`n"
    if ([string]::IsNullOrWhiteSpace($criteriaLines) -or $criteriaLines.Trim() -eq '- [ ]') { throw "Missing active criteria #$($map.number)" }
    $blockerLines = @('- #50 — reconciliation must be reviewed/accepted before further backend implementation.') + @($map.originalBlockers | ForEach-Object { "- #$_ — required backend prerequisite; use its backend acceptance evidence and current approved contracts." })
    $current = @"
## Current execution scope — backend/API only

This existing issue is the single owner of its remaining backend capability. Do not create a duplicate backend implementation ticket. Its former instruction to deliver French product screens/browser journeys in this same slice is superseded by recovery #49. Backend-generated document data/templates and authorized delivery remain in scope; product screen integration belongs to the UI owners below.

## Active acceptance criteria

$criteriaLines
- [ ] Verify authenticated HTTP/application behavior with real isolated PostgreSQL, including role/patient/clinic isolation, relevant failures, conflicts, retries and concurrency. Record tested revision and actual evidence; required type/lint/build checks pass.
- [ ] Expose documented transport contracts sufficient for frontend consumers; maintain existing verified behavior without expanding the testing scaffold into product UI.
- [ ] Record backend acceptance separately. This issue may close for reviewed backend scope only after linking the still-outstanding logic/UI owners; closing it does not complete the full product feature.

## Deferred requirement owners

- Frontend business logic: $logicLinks.
- Designed pages/components and browser journeys: $uiLinks. Shared authentication/navigation: #60. Full requirement coverage/scaffold retirement: #76.
- These requirements are transferred, not waived. Original French UI/document and observable-behavior criteria must be satisfied through these linked owners before product/pilot acceptance.

## Active blocked by

$($blockerLines -join "`n")

Do not add later UI tickets as blockers of this backend issue. #51 verifies backend evidence across #18–#27 without waiting for later UI delivery; a green label/closed issue alone is insufficient evidence.
"@
    $nativeAdds = @(50)
    if ($map.number -eq 18) { $nativeAdds += 23 }
  } else {
    $prereqLines = $map.originalBlockers | ForEach-Object { "- #$_ — existing prerequisite retained." }
    if ($map.number -eq 28) {
      $scope = 'Operational rehearsal only: fictional-data deployment/backups, independent restore consistency/permissions and measured recovery targets under separate operational/spending authorization. Separately authorized operational preparation can precede the real UI, but full acceptance, including the original French browser/user-journey evidence, must wait for #76 and reuse its connected-page evidence. No product UI coding is owned here. No restoration or readiness claim is implied by backend acceptance.'
      $nativeAdds = @()
    } else {
      $scope = 'Final connected fictional-data rehearsal and controlled pilot acceptance only. Require recovered UI/scaffold-retirement evidence from #76 as well as the original clinical, financial, export and measured restoration prerequisites. Real-data, legal/provider and cutover approval remain separate explicit gates. This issue owns no duplicate page implementation and is not executable during the backend-only stage.'
      $prereqLines += '- #76 — recovered connected UI and scaffold-retirement acceptance.'
      $nativeAdds = @(76)
    }
    $current = "## Active scope and acceptance`n`n$scope`n`nThe original substantive operational/pilot acceptance criteria remain required, interpreted with the stage boundaries above.`n`n## Active blocked by`n`n$($prereqLines -join "`n")"
  }
  $body = "$header`n`n$current`n`n## Superseded delivery instructions / original requirement archive`n`n<details>`n<summary>Original issue body preserved for history; current contract above takes precedence for execution</summary>`n`n$($original.body)`n`n</details>`n"
  $bodyPath = Join-Path $destination "issue-$($map.number).md"
  [System.IO.File]::WriteAllText((Join-Path (Get-Location) $bodyPath), $body, [System.Text.UTF8Encoding]::new($false))
  $plan += [pscustomobject]@{ number=$map.number; state=$original.state; bodyPath=$bodyPath; nativeAdds=$nativeAdds }
}
# Add exact source ownership to recovery tickets without changing their approved stage order.
foreach ($number in 50..76) {
  $original = $snapshot | Where-Object number -EQ $number | Select-Object -First 1
  $sources = @($mapping | Where-Object { $_.logic -contains $number -or $_.ui -contains $number } | ForEach-Object number)
  $lineage = if ($sources.Count) { ($sources | ForEach-Object { "- #$_ — retain all product requirements relevant to this ticket's stated capability, including approved amendments; backend ownership stays with the original issue. This ticket owns only its declared logic or UI portion." }) -join "`n" } else { 'Cross-cutting recovery gate; use the complete issue-to-layer mapping in the recovery reconciliation report.' }
  $addon = "`n`n## Reconciled source ownership — 2026-10-18`n`n$lineage`n`nFrontend architecture: feature business logic → components → pages → app routing → main-app composition. Components render state and emit actions; they do not own transport, query orchestration or authoritative server rules. No product UI coding is authorized during backend/logic stages. A ready-for-agent label is not authorization. If requirements conflict, stop the affected work and resolve the specific conflict before proceeding.`n"
  if ($number -eq 50) { $addon += "`nCurrent owner-authorized scope is this reconciliation. Keep this issue open until its independent review and human acceptance; do not implement another ticket automatically. Preserve a recoverable baseline before any future deletion/replacement.`n" }
  if ($number -eq 51) { $addon += "`nBackend acceptance is now the active scope of #18–#27. Their UI requirements remain explicitly transferred to later owners. Record evidence for each capability rather than infer completion from issue state. No dependency from backend completion to future product pages is allowed.`n" }
  $bodyPath = Join-Path $destination "issue-$number.md"
  [System.IO.File]::WriteAllText((Join-Path (Get-Location) $bodyPath), ($original.body + $addon), [System.Text.UTF8Encoding]::new($false))
  $plan += [pscustomobject]@{ number=$number; state=$original.state; bodyPath=$bodyPath; nativeAdds=@() }
}
$plan | ConvertTo-Json -Depth 6 | Set-Content .local-dev/reconciliation/mutation-plan.json -Encoding utf8
if (-not $Publish) { Write-Output "Prepared $($plan.Count) issue-body updates; no remote mutations."; exit }
foreach ($item in $plan) {
  $current = & gh api "repos/$repo/issues/$($item.number)"
  if ($LASTEXITCODE -ne 0) { throw "Read-before-write failed #$($item.number)" }
  $current = ($current -join "`n") | ConvertFrom-Json
  $original = $snapshot | Where-Object number -EQ $item.number | Select-Object -First 1
  $proposed = [System.IO.File]::ReadAllText((Join-Path (Get-Location) $item.bodyPath))
  if ($current.body -ne $original.body -and $current.body -ne $proposed) { throw "Concurrent issue-body change #$($item.number); reconcile before overwriting" }
  if ($current.body -ne $proposed) {
    & gh issue edit $item.number --repo $repo --body-file $item.bodyPath | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Body update failed #$($item.number)" }
  }
  foreach ($dep in $item.nativeAdds) {
    $existing = & gh api "repos/$repo/issues/$($item.number)/dependencies/blocked_by" --jq '.[].number'
    if ($LASTEXITCODE -ne 0) { throw "Dependency read failed #$($item.number)" }
    if (@($existing) -contains [string]$dep) { continue }
    $depId = & gh api "repos/$repo/issues/$dep" --jq '.id'
    if ($LASTEXITCODE -ne 0) { throw "Dependency ID lookup failed #$dep" }
    & gh api --method POST "repos/$repo/issues/$($item.number)/dependencies/blocked_by" -F "issue_id=$depId" --silent
    if ($LASTEXITCODE -ne 0) { throw "Dependency add failed #$($item.number) -> #$dep" }
  }
  Write-Output "Reconciled #$($item.number) (state preserved)"
}
Write-Output 'Reconciliation publication complete; parent issues unchanged; no issues closed/reopened.'
