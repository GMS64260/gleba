/** Format commun à l’upload, aux affectations comptables et à la lecture. Aucun accès disque ici. */
export const PREFIXE_JUSTIFICATIF = '/api/upload/justificatif/'

const NOM_JUSTIFICATIF = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|jpg|png)$/i

export function estNomJustificatif(nom: string): boolean {
  // UUID (36) + point + extension (3). Refuse aussi le saut de ligne final
  // que l’ancre `$` d’une expression régulière JavaScript peut tolérer.
  return nom.length === 40 && NOM_JUSTIFICATIF.test(nom)
}

export function estCheminJustificatif(chemin: string): boolean {
  // Ni décodage, ni normalisation : la valeur validée est celle sauvegardée.
  return chemin.startsWith(PREFIXE_JUSTIFICATIF)
    && estNomJustificatif(chemin.slice(PREFIXE_JUSTIFICATIF.length))
}
