/** Catalogue partagé par le serveur, l'interface et les pages publiques. */
export const ATELIERS = ["maraichage", "verger", "elevage"] as const
export type Atelier = typeof ATELIERS[number]
export type Formule = "essentiel" | "complet"
export const NOMS_ATELIERS: Record<Atelier, string> = {
  maraichage: "Jardin et maraîchage", verger: "Verger", elevage: "Élevage",
}
export const FORMULES = {
  essentiel: { nom: "Essentiel", centimes: 500, prix: 5, description: "Un atelier au choix, pour tenir votre carnet de terrain.", inclus: ["Jardin et maraîchage, verger ou élevage", "Plan et carte de votre terrain", "Suivi, stocks et traçabilité de l’atelier", "Sauvegarde et export de vos données"], exclus: ["Agent IA", "Météo et conseil météo d’irrigation", "Boutique en ligne", "Comptabilité et facturation"] },
  complet: { nom: "Complet", centimes: 1200, prix: 12, description: "Tous vos ateliers et les services de Gleba dans un même carnet.", inclus: ["Tous les ateliers de production", "Agent IA et météo à la parcelle", "Boutique en ligne", "Facturation et précomptabilité", "Sauvegarde et export de vos données"], exclus: [] },
} as const
export const MOIS_ESSAI = 3
/** Décision du propriétaire : inscrits présents au moment de son instruction. */
export const GRATUITE_EXISTANTS_JUSQUAU = "2026-11-08T20:32:07.000Z"
export const VERSION_CONDITIONS_OFFRE = "2026-11-08"
export const TEXTE_OFFRE = "3 mois d’essai gratuits, puis 5 € HT/mois pour un atelier ou 12 € HT/mois pour l’offre complète."
export const TEXTE_EXISTANTS = "Les comptes déjà inscrits lors de l’annonce conservent gratuitement à vie leur accès complet."
export function estAtelier(v: unknown): v is Atelier { return ATELIERS.includes(v as Atelier) }
export function estFormule(v: unknown): v is Formule { return v === "essentiel" || v === "complet" }
