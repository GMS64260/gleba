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
