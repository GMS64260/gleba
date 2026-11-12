/** Catalogue partagé par le serveur, l'interface et les pages publiques. */
export const ATELIERS = ["maraichage", "verger", "elevage"] as const
export type Atelier = typeof ATELIERS[number]
/** Une seule formule payante ; le carnet gratuit n'est pas une formule souscrite. */
export type Formule = "complet"
export const GRATUIT = {
  nom: "Gratuit",
  description: "Tout votre carnet de terrain, pour toujours.",
  inclus: ["Jardin et maraîchage, verger et élevage", "Plan et carte de votre terrain", "Suivi, stocks et traçabilité", "Clients, devis, bons de livraison et factures", "Suivi des règlements et des impayés", "Sauvegarde et export de vos données"],
  exclus: ["Assistant IA", "Météo et conseil d’irrigation", "Boutique en ligne", "Gestion : banque, TVA, bilan, coûts de production"],
} as const
export const FORMULES = {
  complet: { nom: "Complet", centimes: 1200, prix: 12, description: "Le carnet gratuit, plus ce qui vous fait gagner du temps chaque jour.", inclus: ["Tout le carnet gratuit", "Assistant IA : saisie vocale, photos, conseil", "Météo à la parcelle et conseil d’irrigation", "Boutique en ligne", "Gestion : dépenses, banque, TVA, bilan, coûts de production"], exclus: [] },
} as const
export const MOIS_ESSAI = 3
/** Décision du propriétaire : inscrits présents au moment de son instruction. */
export const GRATUITE_EXISTANTS_JUSQUAU = "2026-11-08T20:32:07.000Z"
export const VERSION_CONDITIONS_OFFRE = "2026-11-09"
export const TEXTE_OFFRE = "Gleba est gratuit pour tenir votre carnet. Complet à 12 € HT/mois ajoute l’assistant IA, la météo, la boutique et la gestion ; essayez-le 3 mois sans carte bancaire."
export const TEXTE_EXISTANTS = "Les comptes déjà inscrits lors de l’annonce conservent gratuitement à vie leur accès complet."
