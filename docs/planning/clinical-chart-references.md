# Clinical chart references — issue #5

Checked: 2026-10-11. Focused reference check for the existing discovery decisions; no application implementation or medication advice. Anatomy/notation facts below are separate from the proposed product vocabulary.

## Tooth positions

ISO 3950:2016 specifies a two-digit designation system. Its public catalogue confirms the standard and scope; the full normative text was not accessed. Source: [ISO 3950 catalogue](https://www.iso.org/standard/68292.html).

The published ADA tooth-designation code system and SNODENT value set in HL7 Terminology include explicit ISO designations for permanent and primary teeth. They support these ordinary position ranges (left/right always belong to the patient):

| Patient quadrant | Permanent | Primary |
| --- | --- | --- |
| Upper right | 11–18 | 51–55 |
| Upper left | 21–28 | 61–65 |
| Lower left | 31–38 | 71–75 |
| Lower right | 41–48 | 81–85 |

Within each range, the second digit runs from the central incisor outward. Permanent positions 1/2 are incisors, 3 canine, 4/5 premolars, 6/7/8 molars; primary positions 1/2 are incisors, 3 canine, 4/5 molars. Sources: [ADA code system published by HL7](https://terminology.hl7.org/7.1.0/en/CodeSystem-ADAUniversalToothDesignationSystem.ttl.html), [SNODENT international designation value set](https://terminology.hl7.org/7.4.0/en/ValueSet-v3-SnodentDentalUniversalNumberingSystemInternational.html).

Product consequence: store the numbering scheme explicitly as FDI/ISO; do not interpret Universal numbers as FDI. For example, Universal 51 is a supernumerary permanent designation in the code system, whereas ISO 51 is a primary central incisor. These ranges cover normal chart positions, not an exhaustive supernumerary model. Mixed dentition can include both primary and permanent positions; do not infer tooth presence from age.

## Surfaces

| Surface | Meaning / applicability |
| --- | --- |
| Mesial | Toward the dental midline |
| Distal | Away from the dental midline |
| Facial | Outer surface facing lips/cheeks; labial for anterior teeth, buccal for posterior teeth |
| Lingual | Inner surface toward the tongue |
| Palatal | Surface adjacent to the palate; appropriate upper-tooth inner-surface label |
| Incisal | Biting edge of anterior teeth (incisors/canines) |
| Occlusal | Chewing surface of posterior teeth (premolars/molars) |

Sources: [American Dental Assistants Association, Dental Anatomy: A Review, “Surfaces of Teeth”](https://cdeworld.com/courses/21595-dental-anatomy-a-review), [American Dental Association glossary](https://www.ada.org/publications/cdt/glossary-dental-terms), [Australian Dental Association schedule and glossary, 13th edition](https://ada.org.au/getmedia/af3b78d7-2b5c-4e61-b2a0-08af9ef48fb2/ADA_Handbook_Australian-Schedule-and-Dental-Glossary-13th-Edition.pdf).

Proposed UI mapping: five logical surface locations per ordinary tooth: M, D, outer, inner, and I for anterior/O for posterior. Render outer as labial/buccal and inner as palatal for upper teeth/lingual for lower teeth. This normalization is a product choice; ADA claim codes separately include B, F, L, I, M, D and O. It is not a claim of billing-code interoperability. Source: [ADA anterior restoration surface guide](https://www.ada.org/-/media/project/ada-organization/ada/ada-org/files/publications/cdt/guide_to_coding_anterior_tooth_restorations_.pdf?hash=5AAC509E522AC3D19201AC3F44E0746C&rev=3778d31bdf734c298eeb18a4e5605f8b).

## Manual vocabulary: pre-decision research, now superseded by approved contract

Owner-approved terms are recorded in clinical-decisions.md: sound, caries, restoration, missing/extracted, unerupted, fracture, crown, root canal, implant, other with free text. This list is a convenient manual vocabulary, not an established medical classification, diagnostic algorithm or licensed terminology import.

These terms overlap and should not become one mutually exclusive status enum:

- Presence/eruption: present, missing, unerupted. Extraction is a cause/history of missing, not equivalent to every missing tooth. Unknown/not assessed should remain distinct from sound.
- Findings: caries, fracture, sound assessment and other; findings may apply to a tooth or particular surfaces.
- Existing work/device/history: restoration, crown, root-canal treatment and implant. A crown and root-canal treatment can coexist; a restored tooth can also have caries. A natural tooth can be absent while an implant occupies its site.

These are modeling cautions for owner/clinician review, not clinical treatment advice. Distinguish an existing condition/work from a planned procedure or completed procedure event; a chart selection must not silently create treatment or a charge. The subsequent compact owner approvals and consolidated clinical-decisions.md settle the product scope and coexisting-finding model; do not repeat that questionnaire. Qualified clinic validation remains a real-use gate.

## Prescription boundary and source limits

Existing discovery already accepted patient, prescriber, medicine, dose, route, frequency, duration and instructions fields. This note does not reopen that decision or establish prescription legality. Applicable legal prescription requirements remain an explicit pilot gate requiring jurisdiction/qualified review; no legal discovery was performed here.

No complete normative ISO text was reviewed, no licensed CDT/SNODENT catalogue was imported, and no clinical completeness or legal compliance is claimed. The sources verify notation and surface terminology only. The selected vocabulary and normalized UI are governed by the subsequently approved clinical-decisions.md; clinician validation remains required before real use, and implementation/pilot readiness stay separately gated.

The Australian glossary's palatal definition was available in the official search excerpt; direct PDF retrieval failed in the browsing tool. Recheck that entry from the publisher document during clinical validation.
