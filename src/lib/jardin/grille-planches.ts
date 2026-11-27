/**
 * Grille sans recouvrement pour « Réorganiser » le plan : chaque colonne prend
 * la largeur de sa planche la plus large, chaque rangée la longueur de sa plus
 * longue. Calculé planche par planche sur ses propres dimensions, le pas
 * superposait des planches de tailles différentes (équipe debug, D236).
 * Une planche tournée compte pour son emprise réelle.
 */
type PlancheEnGrille = { largeur?: number | null; longueur?: number | null; rotation2D?: number | null }

/** Emprise d'une planche tournée autour de son centre, et dimensions propres. */
function emprise(planche: PlancheEnGrille) {
  const largeur = planche.largeur || 0.8
  const longueur = planche.longueur || 2
  const angle = ((planche.rotation2D || 0) * Math.PI) / 180
  const cos = Math.abs(Math.cos(angle))
  const sin = Math.abs(Math.sin(angle))
  return { largeur, longueur, emprisX: largeur * cos + longueur * sin, emprisY: largeur * sin + longueur * cos }
}

export function positionsEnGrille<T extends PlancheEnGrille>(
  planches: T[],
  ecart = 0.5,
): Array<{ posX: number; posY: number }> {
  const colonnes = Math.max(1, Math.ceil(Math.sqrt(planches.length)))
  const largeurColonne: number[] = Array(colonnes).fill(0)
  const longueurRangee: number[] = []
  planches.forEach((planche, i) => {
    const colonne = i % colonnes
    const rangee = Math.floor(i / colonnes)
    const e = emprise(planche)
    largeurColonne[colonne] = Math.max(largeurColonne[colonne], e.emprisX)
    longueurRangee[rangee] = Math.max(longueurRangee[rangee] ?? 0, e.emprisY)
  })
  const debuts = (tailles: number[]) => tailles.map((_, k) => tailles.slice(0, k).reduce((somme, taille) => somme + taille + ecart, 0))
  const x = debuts(largeurColonne)
  const y = debuts(longueurRangee)
  // La position stockée est celle du coin de la planche NON tournée ; la
  // rotation se fait autour du centre : on décale pour que l'emprise tournée
  // commence au début de sa case.
  const arrondi = (n: number) => Math.round(n * 1000) / 1000
  return planches.map((planche, i) => {
    const e = emprise(planche)
    return {
      posX: arrondi(x[i % colonnes] + (e.emprisX - e.largeur) / 2),
      posY: arrondi(y[Math.floor(i / colonnes)] + (e.emprisY - e.longueur) / 2),
    }
  })
}
