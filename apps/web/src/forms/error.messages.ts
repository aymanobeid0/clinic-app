export const errorMessages = {
  required: "Ce champ est obligatoire.",
  email: "Saisissez une adresse e-mail valide.",
  tooShort: (length: number) => `Saisissez au moins ${length} caractères.`,
  invalid:
    "La valeur est invalide. Vérifiez le format et les limites indiqués.",
  unreadable: "Réponse illisible. Actualisez l’état avant de réessayer.",
  unverified:
    "Votre accès n’a pas pu être vérifié. Vérifiez votre connexion et les informations saisies.",
  forbidden:
    "La demande a été refusée. Actualisez la page et vérifiez vos autorisations avant de réessayer.",
  rateLimited: "Trop de demandes. Patientez avant de réessayer.",
  uncertain:
    "Impossible de confirmer le résultat. Actualisez l’état avant de réessayer.",
};
