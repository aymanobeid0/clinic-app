import { z } from "zod";

// Known contract fields only: never reflect arbitrary object keys or submitted values.
const labels: Record<string, string> = {
  password: "Mot de passe",
  currentPassword: "Mot de passe actuel",
  temporaryPassword: "Mot de passe temporaire",
  email: "Adresse e-mail",
  username: "Identifiant",
  clinicCode: "Code de la clinique",
  displayName: "Nom affiché",
  name: "Nom",
  phone: "Téléphone",
  contactKind: "Type de contact",
  contactName: "Nom du contact",
  kind: "Type",
  status: "Statut",
  method: "Mode",
  permissions: "Autorisations",
  patientId: "Patient",
  doctorId: "Médecin",
  chairId: "Fauteuil",
  date: "Date",
  dueOn: "Échéance",
  revision: "Version",
  commandId: "Référence de la demande",
  reason: "Motif",
  amount: "Montant",
  currency: "Devise",
  precision: "Précision",
  category: "Catégorie",
  format: "Format",
  classification: "Classe du fichier",
  token: "Code de vérification",
  code: "Code",
  saved: "Confirmation de sauvegarde",
  batchId: "Lot",
  itemId: "Article",
  supplierId: "Fournisseur",
  quantity: "Quantité",
  packs: "Paquets",
  receivedPacks: "Paquets reçus",
  totalCost: "Coût total",
  expiresOn: "Date de péremption",
  expiryDate: "Date de péremption",
  expiryRequired: "Péremption obligatoire",
  label: "Libellé",
  active: "Actif",
  items: "Actes",
  procedures: "Actes",
  extras: "Frais supplémentaires",
  price: "Prix",
  basePrice: "Prix de base",
  discount: "Remise",
  duration: "Durée",
  startsAt: "Début",
  endsAt: "Fin",
  durationMinutes: "Durée en minutes",
  note: "Note",
  text: "Texte",
  content: "Contenu",
  title: "Titre",
  medicine: "Médicament",
  dose: "Dose",
  route: "Voie",
  frequency: "Fréquence",
  instructions: "Instructions",
  tooth: "Dent",
  teeth: "Dents",
  surfaces: "Surfaces",
  findings: "Constats",
  allergies: "Allergies",
  history: "Antécédents",
  chargeId: "Charge",
  allocations: "Affectations",
  charges: "Charges",
  paymentMethodId: "Moyen de paiement",
  newMoney: "Nouveau versement",
  finalCharge: "Montant corrigé",
  attachments: "Pièces jointes",
  id: "Référence",
  versions: "Versions",
  value: "Valeur",
  accountId: "Compte",
  isManager: "Responsable",
  clinicName: "Nom de la clinique",
  batch: "Lot",
  identity: "Identité",
  medicalHistory: "Antécédents médicaux",
  observedAt: "Date du constat",
  medicines: "Médicaments",
  strength: "Dosage",
  form: "Forme",
  conditions: "Conditions",
  treatments: "Traitements",
  otherNotes: "Autres notes",
  extractionHistory: "Extractions",
  dentition: "Dentition",
  presence: "Présence",
  chartCategory: "Catégorie du constat",
  dentistId: "Dentiste",
  appointmentId: "Rendez-vous",
  starts: "Début",
  defaultDurationMinutes: "Durée par défaut",
  chairs: "Fauteuils",
  override: "Dérogation",
  acceptedAt: "Date d’acceptation",
  acceptedBy: "Acceptation par",
  attachment: "Pièce jointe",
  attachmentId: "Pièce jointe",
  planId: "Plan",
  procedureId: "Acte",
  priceMinor: "Prix",
  baseMinor: "Prix de base",
  discountMinor: "Remise",
  discountReason: "Motif de remise",
  totalCostMinor: "Coût total",
  quantityPacks: "Nombre de paquets",
  balancePacks: "Paquets comptés",
  stockRevision: "Version du stock",
  receivedAt: "Date de réception",
  lowStockThreshold: "Seuil de stock",
  countedPacks: "Paquets comptés",
  expiryWarningDays: "Délai d’alerte de péremption",
  batchNumber: "Numéro de lot",
  amountMinor: "Montant",
  targetMinor: "Montant cible",
  newMoneyMinor: "Nouveau versement",
  depositMinor: "Dépôt",
  creditMinor: "Crédit",
  methodId: "Moyen de paiement",
  sourceId: "Source",
  sources: "Sources",
  targets: "Actes concernés",
  chargeIds: "Charges",
  invoiceIds: "Factures",
  settlementId: "Règlement",
  settlementIds: "Règlements",
  cancellationReason: "Motif d’annulation",
  header: "En-tête",
  footer: "Pied de page",
  cutoff: "Date limite historique",
  action: "Action",
  scope: "Périmètre",
  visitId: "Visite",
  planRevision: "Version du plan",
  proposalRevision: "Version de la proposition",
  chartRevision: "Version du schéma",
  catalogRevision: "Version du catalogue",
  numberingScheme: "Numérotation",
  selected: "Actes sélectionnés",
  confirmedAt: "Date de confirmation",
  confirmedBy: "Confirmation par",
  provenance: "Origine",
  openingBalances: "Soldes initiaux",
  asOf: "Date du solde",
  path: "Référence",
  replaces: "Version remplacée",
};

type Issue = {
  code: string;
  input?: unknown;
  minimum?: unknown;
  maximum?: unknown;
  origin?: string;
  format?: string;
  inclusive?: boolean;
};
function guidance(issue: Issue, input: unknown): string {
  if (input === undefined || input === "") return "Ce champ est obligatoire.";
  if (issue.code === "too_small") {
    const n = String(issue.minimum);
    if (issue.origin === "string") return `Saisissez au moins ${n} caractères.`;
    if (issue.origin === "array")
      return `Sélectionnez au moins ${n} élément(s).`;
    return issue.inclusive === false
      ? `Saisissez une valeur strictement supérieure à ${n}.`
      : `Saisissez une valeur supérieure ou égale à ${n}.`;
  }
  if (issue.code === "too_big") {
    const n = String(issue.maximum);
    if (issue.origin === "string")
      return `Saisissez au maximum ${n} caractères.`;
    if (issue.origin === "array")
      return `Sélectionnez au maximum ${n} élément(s).`;
    return issue.inclusive === false
      ? `Saisissez une valeur strictement inférieure à ${n}.`
      : `Saisissez une valeur inférieure ou égale à ${n}.`;
  }
  if (issue.code === "invalid_format" && issue.format === "email")
    return "Saisissez une adresse e-mail valide.";
  if (issue.code === "invalid_type")
    return "Le type de valeur est incorrect. Vérifiez ce champ.";
  if (issue.code === "invalid_value" || issue.code === "invalid_union")
    return "Sélectionnez une valeur autorisée.";
  return "La valeur est invalide. Vérifiez le format et les champs associés.";
}

// RHF's Zod resolver and direct schema parsing use the same safe French vocabulary.
z.config({ customError: (issue) => guidance(issue, issue.input) });

export type FieldGuidance = Record<string, string>;
export function validationFields(
  error: z.ZodError,
): FieldGuidance {
  const fields: FieldGuidance = {};
  for (const issue of error.issues) {
    if (Object.keys(fields).length >= 20) break;
    if (
      !issue.path.length ||
      !issue.path.every((p) =>
        typeof p === "number"
          ? Number.isInteger(p) && p >= 0 && p <= 10000
          : typeof p === "string" && Object.hasOwn(labels, p),
      )
    )
      continue;
    const path = issue.path.join(".");
    if (path.length > 160 || Object.hasOwn(fields, path)) continue;
    // The configured validator has already classified missing/empty input.
    // Do not guess whether the failing schema parsed body, query or params.
    const value = issue.message === "Ce champ est obligatoire." ? undefined : true;
    fields[path] = guidance(issue, value).slice(0, 256);
  }
  return fields;
}

export function fieldSummary(
  fields: FieldGuidance,
  fallback = "Vérifiez les champs saisis.",
) {
  const entries = Object.entries(fields).slice(0, 20);
  return entries.length
    ? entries
        .map(([path, message]) => {
          const label = path
            .split(".")
            .map(
              (p) =>
                labels[p] ??
                (/^\d+$/.test(p) ? String(Number(p) + 1) : "Champ"),
            )
            .join(" / ");
          return `${label} : ${message}`;
        })
        .join(" ")
    : fallback;
}

export function validationSummary(error: z.ZodError) {
  return fieldSummary(validationFields(error));
}
