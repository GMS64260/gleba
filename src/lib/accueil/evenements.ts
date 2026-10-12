/**
 * Événements fenêtre de l'accueil v2. L'assistant (`ChatBubble`, monté dans
 * le layout racine) écoute `EVENEMENT_OUVRIR_ASSISTANT` : la tuile agent
 * ouvre le panneau existant au lieu d'en instancier un second. Aucun appel au
 * modèle n'est fait depuis l'accueil (L2).
 */

export const EVENEMENT_OUVRIR_ASSISTANT = "gleba:ouvrir-assistant"

export interface DetailOuvrirAssistant {
  /** Question suggérée (non envoyée automatiquement). */
  question?: string
}

export function ouvrirAssistant(detail: DetailOuvrirAssistant = {}): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent<DetailOuvrirAssistant>(EVENEMENT_OUVRIR_ASSISTANT, { detail }))
}

/** La barre de commande de l'accueil ouvre la palette de recherche existante (`GlobalSearch`). */
export const EVENEMENT_OUVRIR_RECHERCHE = "gleba:ouvrir-recherche"

export function ouvrirRecherche(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(EVENEMENT_OUVRIR_RECHERCHE))
}

/**
 * « Noter une intervention » (palette) quand le registre est déjà affiché : la
 * page ne se remonte pas sur `?nouvelle=1`, elle ouvre sa fiche sur cet
 * événement (QA cmv2r57qk).
 */
export const EVENEMENT_NOUVELLE_INTERVENTION = "gleba:nouvelle-intervention"

export function ouvrirNouvelleIntervention(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(EVENEMENT_NOUVELLE_INTERVENTION))
}

/**
 * Calendrier lunaire (ticket QA cmv4zb9yy) : il vivait dans l'en-tête
 * historique, que le rail de l'accueil v2 remplace. La palette et la tuile
 * Raccourcis l'ouvrent par événement ; `LunaireWidget` s'inscrit tant qu'il est
 * monté, pour que la palette ne propose pas une entrée sans effet.
 */
export const EVENEMENT_OUVRIR_LUNE = "gleba:ouvrir-calendrier-lunaire"

/**
 * Un widget monté n'est pas forcément visible (rail masqué sous `lg`, en-tête
 * masqué dès `lg`, chargement en cours) : chacun s'inscrit avec sa propre
 * fonction de visibilité, et la palette ne propose l'entrée que si l'un d'eux
 * peut répondre (relecture du 2026-10-12).
 */
const calendriersLunaires = new Set<() => boolean>()

export function enregistrerCalendrierLunaire(visible: () => boolean): () => void {
  calendriersLunaires.add(visible)
  return () => {
    calendriersLunaires.delete(visible)
  }
}

export function calendrierLunaireDisponible(): boolean {
  for (const visible of calendriersLunaires) if (visible()) return true
  return false
}

export function ouvrirCalendrierLunaire(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(EVENEMENT_OUVRIR_LUNE))
}
