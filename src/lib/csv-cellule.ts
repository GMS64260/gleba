/**
 * Cellule d'un export CSV, PURE et importable côté écran comme côté serveur.
 *
 * Deux protections, toujours ensemble :
 *  - guillemets autour de la valeur (un « ; », une virgule ou un saut de ligne
 *    saisis par l'utilisateur ne décalent plus les colonnes) ;
 *  - neutralisation des préfixes qu'un tableur exécute comme une formule
 *    (`=`, `+`, `-`, `@`, tabulation, retour chariot) : une désignation
 *    « =HYPERLINK(…) » ouvrait un lien à l'ouverture du fichier.
 *
 * Un nombre est écrit tel quel : « -12.5 » est un montant, pas une formule.
 */
export function celluleCsv(valeur: unknown): string {
  if (valeur === null || valeur === undefined) return '""'
  if (typeof valeur === 'number') return Number.isFinite(valeur) ? String(valeur) : '""'
  const texte = String(valeur)
  const sur = /^[=+\-@\t\r]/.test(texte) ? `'${texte}` : texte
  return `"${sur.replaceAll('"', '""')}"`
}
