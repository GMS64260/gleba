/**
 * Aperçu d'un document avant téléchargement.
 *
 * Besoin du 2026-08-19 : tout document PDF de Gleba doit d'abord s'AFFICHER
 * dans la fenêtre. Un téléchargement natif sort l'utilisateur de
 * l'application — et bloque net un agent de test qui explore Gleba au
 * navigateur : le fichier quitte la page, il n'a plus rien à inspecter.
 *
 * Les URL d'aperçu pointent l'écran `/apercu`, qui charge le document, le rend
 * dans la fenêtre et offre le téléchargement en un clic.
 */

/**
 * Un document ne s'aperçoit que s'il vient de NOTRE API.
 *
 * `src` arrive par la query de `/apercu` : sans ce contrôle, l'écran
 * accepterait de charger n'importe quelle URL fournie par un tiers (fuite du
 * cookie de session vers un serveur étranger, hameçonnage sous le domaine de
 * Gleba). On n'accepte donc qu'un chemin relatif de l'API, jamais une URL
 * absolue, jamais un chemin protocole-relatif (`//ailleurs`).
 */
export function cheminDocumentValide(src: string | null | undefined): src is string {
  if (!src) return false
  if (!src.startsWith('/api/')) return false
  if (src.startsWith('//')) return false
  // `:` interdit hors query : écarte `javascript:` et les URL absolues glissées
  // dans le chemin. Les paramètres, eux, peuvent légitimement en contenir.
  const [chemin] = src.split('?')
  if (chemin.includes(':') || chemin.includes('\\')) return false
  return true
}

/** URL de l'écran d'aperçu pour un document de l'API. */
export function urlApercu(src: string, titre?: string): string {
  const params = new URLSearchParams({ src })
  if (titre) params.set('titre', titre)
  return `/apercu?${params.toString()}`
}

/**
 * Même URL de document, mais qui force le téléchargement (cf.
 * `src/lib/http/disposition-fichier.ts`).
 */
export function urlTelechargement(src: string): string {
  return `${src}${src.includes('?') ? '&' : '?'}telecharger=1`
}

/**
 * Ouvre l'aperçu d'un document dans un nouvel onglet.
 *
 * À utiliser depuis un gestionnaire de clic plutôt qu'un `<a href>` quand le
 * bouton vit dans une modale Radix, où le clic d'un lien peut être intercepté
 * (constat du 2026-07 sur le dossier de campagne du verger).
 */
export function ouvrirApercu(src: string, titre?: string): void {
  if (typeof window === 'undefined') return
  window.open(urlApercu(src, titre), '_blank', 'noopener')
}
