# Clinical chart and prescription contracts — issue #5

> Status reconciliation — 2026-10-11: statements below about open issues, uncommitted work, pending planning review or absent implementation describe the original document snapshot. Prerequisite evidence is now merged in PR #30, workflow retirement in PR #31, and owner-approved issues #2–#6 are closed. The initial #7 HTTP/session slice was published in draft PR #32; subsequent implementation status is recorded in the linked delivery status. See [current delivery status](delivery-status.md) for completed work and remaining gates. Approved product rules remain authoritative; later approved contracts supersede discovery proposals.

Date: 2026-10-11. Status: compact owner decisions approved; independent planning review passed; see clinical-review.md. No implementation authorized. Source: current issue #5, Spec 001/discovery and owner popup approvals. This consolidated contract supersedes earlier pending-question text. Issue #5 is open with no listed blockers at last read.

## Chart identity and validation

Use FDI/ISO two-digit positions, always from the patient's perspective: permanent upper-right 11–18, upper-left 21–28, lower-left 31–38, lower-right 41–48; primary upper-right 51–55, upper-left 61–65, lower-left 71–75, lower-right 81–85. Mixed dentition permits both normal sets; do not infer presence from patient age. Store numbering scheme explicitly; do not interpret Universal numbering as FDI. Supernumerary/special positions have no invented normal FDI code; record explanatory Other notes until explicitly supported.

Logical surfaces: mesial, distal, outer (labial anterior/buccal posterior), inner (palatal upper/lingual lower), and incisal anterior or occlusal posterior. Anterior means incisors/canines (second digit 1–3); posterior means permanent premolars/molars (4–8) or primary molars (4–5). Validate tooth code and surface combination; whole-tooth findings need no fabricated surface. Reject occlusal on anterior and incisal on posterior. Technical facts and source limits are in clinical-chart-references.md; this is not billing-code interoperability.

## Manual findings and revisions

Approved manual vocabulary: sound, decay/caries, restoration, missing, extracted, unerupted, fracture, crown, root-canal treatment, implant and Other with required free-text note. Findings can coexist (e.g. crown plus root canal, restoration plus decay). Model presence/eruption, observed conditions and existing treatment/devices separately, not as one mutually exclusive enum. Unknown/unassessed is not sound. Missing does not prove extraction; retain extraction history separately. An implant may occupy a missing natural-tooth site.

Decay/restoration/fracture/Other may target whole tooth or selected valid surfaces; presence, extraction, unerupted, crown/root canal and implant refer to tooth/site, not arbitrary surfaces. Preserve author, patient, tooth/surfaces, observation time, draft/finalizer and revision history. Staff with clinical capability/patient scope draft; doctors review/confirm. No chart finding silently creates a treatment plan, performed procedure or charge. Finalized changes create dated corrections/revisions, never overwrite. Historical views select permitted versions at the care-removal cutoff, excluding later revisions.

## Procedure-to-chart suggestions

Only explicit supported procedure categories suggest changes at completion; do not infer categories from free-text names. Suggestions remain non-authoritative pending authorized dentist review/confirmation of patient, tooth and applicable surfaces. No automatic chart mutation, diagnosis or AI inference. Whole-mouth/multi-tooth procedures must specify explicit valid targets before any suggestion can be accepted. Unsupported/unmapped procedures remain manual.

| Completed category | Proposed chart event |
| --- | --- |
| Extraction | Record extraction/missing natural tooth at the confirmed position |
| Filling/restoration | Record restoration on dentist-confirmed tooth/surfaces |
| Crown | Record crown at the confirmed tooth/site |
| Root canal | Record root-canal treatment at the confirmed tooth |
| Implant | Record implant at confirmed site, without marking a natural tooth present |

Suggestions do not erase other findings or assert that decay/fracture is resolved. Dentist explicitly chooses any resolution/correction. Dismissed suggestions create no finding; retries cannot duplicate the confirmed completion-derived event. Existing restorations and historical root canal/crown entries remain distinct from newly performed procedure events.

## Prescriptions and reusable drug catalog

Manual prescription content: patient identity, prescriber identity, issue date, and one or more manually authored medicine entries with dose, route, frequency, duration and instructions. Reusable clinic print header/footer; French pilot output. No automated drug/dose recommendation, diagnosis or medication advice. These fields do not establish legal prescription sufficiency.

Owner addition: doctors manage reusable clinic drug entries/details in clinic settings, subject to clinical eligibility; non-doctor managers cannot gain clinical drug/prescription access merely through settings authority. Catalog entries are optional shortcuts, not required for free-text prescriptions. Selecting a saved entry copies its details into an editable prescription draft for doctor review. Later catalog edits/removal cannot change saved prescriptions; retain their selected text snapshot. Do not infer or silently fill a dose from patient characteristics. Clinical access/authoring/finalization follows identity-access-decisions.md.

Staff may draft authorized patient prescriptions; doctors review/finalize, preserving author and finalizing prescriber attribution. Only finalized prescriptions may be printed as an issued prescription; drafts are clearly marked and cannot masquerade as issued output. Corrections create a linked replacement and mark the old finalized version superseded, preserving both versions and dates/actors. Reprints use the unchanged chosen finalized version and its status; superseded output is clearly marked. Updating a clinic print template never alters retained issued clinical content or prescriber identity. Access/printing requires active patient scope plus capability; historical access is read-only with no printing/download/export.

## Acceptance examples and verification gates

- FDI 11 is permanent upper-right central incisor; 51 is its primary-position designation. Mixed chart may show both positions with independent presence states.
- Occlusal on 11 or incisal on 16 is rejected; mesial/distal and normalized outer/inner are allowed on valid positions. Invalid code 59 is rejected.
- A crowned, root-canal-treated tooth may retain both histories; unassessed position is never auto-labeled sound.
- Complete a filling: only a pending suggestion exists until the dentist confirms surfaces; dismissal leaves the chart unchanged, replaying confirmation adds no duplicate event.
- Select a saved drug entry, edit instructions and finalize. Later catalog edits do not alter that prescription. Correction retains the old version as superseded and creates a linked replacement.
- A non-doctor manager is denied chart/drug-catalog/prescription access despite financial/settings authority. Staff drafts require patient scope; staff cannot finalize. Historical views cannot include later corrections.

Owner approved the three compact clinical choices and one detail confirmation, including reusable doctor-managed drug catalog, coexistence of findings/unassessed distinction and immutable copied prescription content. Independent planning review passed; see clinical-review.md. Evidence/reference limits are in clinical-chart-references.md: full ISO text not accessed; no licensed terminology imported; one publisher PDF retrieval failed. Notation facts are distinct from chosen product vocabulary and clinician judgment.

Before real use, obtain qualified clinic validation of chart labels/surface rendering and prescription content/layout, and verify applicable jurisdiction-specific prescriber identifiers, signatures/stamps, required patient/drug fields, controlled-drug restrictions, correction/retention and printing requirements. No legal compliance or complete clinical terminology is claimed. Do not enable unsupported regulated prescription use based solely on this note. No medication/legal discovery, patient data or drug recommendations were performed. File retention remains under #6; finance attribution/corrections follow the reviewed finance/identity contracts. Runtime concurrency, versioning and permission tests remain later implementation work.
