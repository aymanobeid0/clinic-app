# Pilot data requirements — issue #6

Checked 2026-10-11. Focused prerequisite assessment for a Mauritania dental clinic using the owner-reported Germany VPS and selected Contabo S3 EU backups. Builds on foundation-infrastructure-assessment.md and foundation-backup-options.md; does not reopen their accepted architecture, backup method, budget or same-provider risk. No purchase, regulator contact, account inspection or real patient processing performed. This is a planning gate, not a legal compliance determination.

## Mauritania: verified statutory signposts

The APD publishes [Law 2017-020](https://www.apd.mr/fr/wp-content/uploads/2023/10/Loi-2017-020-sur-la-protection-des-donnees-a-caractere-personnel.pdf). Readable clauses establish:

- Articles 2–3 define health information and third countries and address Mauritanian processing scope.
- Articles 12–15 restrict health-related processing and provide exceptions, including conditions for care/diagnosis. Do not treat ordinary account consent as automatic satisfaction.
- Article 11 requires a written processor arrangement; Article 7 limits retention by purpose, without supplying a dental-record duration here.
- Articles 20–23 require sufficient destination protection, an APD-maintained country list, and prior APD information for destinations absent from that list. Article 25 permits authorization based on sufficient guarantees, including contractual clauses.
- Articles 32–33 distinguish exemptions and declaration/receipt. Article 37 lists authorization categories, including genetic/health research, national identifiers, biometrics and interconnection. It does not simply say every ordinary clinical record requires health-research authorization.

The scan/OCR is imperfect: Article 24’s opening and part of Article 2’s sensitive-data definition were not reliably readable. Do not rely on inferred exceptions. No current APD adequate-country list, clinic-specific exemption or completed form/authorization was verified. Qualified Mauritanian review must identify the applicable route before patient data leaves Mauritania.

## EU scope: clinic and host must be assessed separately

The [EDPB territorial-scope guidelines](https://www.edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_3_2018_territorial_scope_after_public_consultation_en_1.pdf), section 1(c)(ii), explain that a non-EU controller does not become subject to GDPR merely by choosing an EU processor. An EU-established processor can have its own GDPR obligations. Article 3 assessment depends on establishment and, for relevant non-EU activities, offering services to or monitoring people in the Union. The guidelines also identify processor contract, security and transfer obligations.

Planning consequence: do not declare this Mauritania clinic GDPR-compliant or GDPR-exempt from the VPS location alone. A professional must assess the actual clinic activity, provider role and any access/return transfers. EU hosting also does not establish compliance with Mauritanian outbound-transfer rules.

## Contabo: verified public evidence versus account evidence

[Object Storage documentation](https://docs.contabo.com/docs/storage/object-storage/) identifies an EU region and eu2 endpoint, with no region migration without written consent. It documents TLS and encryption at rest. It does not identify the selected account’s exact storage country, support-access countries or subprocessors. “EU” is therefore a regional choice, not proof of Germany-only storage.

[Contabo terms](https://contabo.com/en-us/legal/terms-and-conditions/) permit outsourcing and relocation to another data centre within the selected region. They describe supplying the provider with processing information through its customer-portal agreement workflow. Obtain the applicable signed terms rather than assuming public text proves this account’s arrangement.

[Contabo DPA documentation](https://docs.contabo.com/docs/dpa/dpa/) says its portal-generated agreement can cover VPS and Object Storage and that the concluded PDF is downloadable. Public availability is not evidence that this clinic has concluded it or accurately described health data and data subjects.

[Contabo’s current EU location article](https://contabo.com/blog/contabo-eu-data-centers-latency-gdpr/) describes Lauterbourg, France, as the current primary EU hub for new deployments and mentions historical German facilities. It is marketing evidence, not confirmation of either existing VPS or backup placement. Do not transfer its broad compliance language into this project’s acceptance claims.

## Evidence required before a real-data pilot

The following are project gates proposed from the unresolved evidence, not claims that every item is independently prescribed by a particular clause:

1. Record clinic controller identity, responsible owner and qualified Mauritanian reviewer; document purposes, categories, recipients, relevant patient/minor handling and applicable health-data basis.
2. Obtain a current professional determination of the APD declaration/exemption/authorization and outbound-transfer route for the actual named countries. Retain any necessary receipt/decision before processing; do not substitute EU residency or encryption for this determination.
3. Obtain account-specific VPS and Object Storage location evidence, applicable contracting entity, DPA covering both services and health-data processing, subprocessor list, support/administrative access locations, onward-transfer safeguards and change-notification terms. Confirm whether an EU region can span countries and how changes are governed.
4. Approve separate retention/deletion schedules for clinical records, prescriptions, financial records, attachments, audit/security logs and backup copies. Identify professional/statutory retention obligations; none were verified here. The accepted 7-day/four-week backup scheme is an operational recovery policy, not a legal record-retention period.
5. Review patient information/rights procedures, correction/access/export, deletion exceptions, confidentiality and incident handling. Test access controls, encryption/key recovery, private storage, audit and restoration with fictional data under existing acceptance criteria.
6. Record explicit pilot authorization only after the evidence and professional review are resolved. Planning acceptance may record these gates as outstanding; it cannot authorize real data, deployment or a purchase.

No legal retention duration, breach deadline, adequacy finding, medical hosting certification requirement or completed regulatory form is asserted. Current amendments, APD procedures and any sector-specific health rules remain professional-verification work. Public provider docs were checked; private contract/location evidence remains unavailable.
