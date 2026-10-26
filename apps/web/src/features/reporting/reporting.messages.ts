// French interface boundary; keep server-provided safe errors intact.
export const reportingMessages = {
  followUpSaved: "Suivi enregistré.",
  followUpInvalid: "Vérifiez le patient, la date et la révision du suivi.",
  exportReady: "Export préparé. Aucune donnée n’a été envoyée à un tiers.",
  exportExpired: "Export expiré. Préparez un nouvel export.",
  exportInvalid:
    "Vérifiez la catégorie, le format et les éléments sélectionnés.",
  exportDenied: "Vous n’êtes pas autorisé à effectuer cet export.",
  exportUnavailable: "Export indisponible.",
  exportMismatch: "Le fichier reçu ne correspond pas à l’export. Réessayez.",
  cleanupUnavailable: "Nettoyage indisponible.",
} as const;
