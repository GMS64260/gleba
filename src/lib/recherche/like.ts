/**
 * Filtre Prisma « contient ce texte », au sens littéral.
 *
 * `contains` produit un `LIKE` sans échappement : `%`, `_` et `\` saisis par
 * l'utilisateur y sont des jokers. Chercher « % » ramenait toutes les lignes
 * (équipe debug, D25 pour la recherche globale, D229 pour la liste des
 * cultures).
 */
export function contientLitteral(texte: string) {
  return { contains: texte.replace(/[\\%_]/g, '\\$&'), mode: 'insensitive' as const }
}
