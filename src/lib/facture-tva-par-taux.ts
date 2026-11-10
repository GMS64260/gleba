/**
 * Ventilation de la TVA d'une facture par taux, pour les formats structurés
 * (UBL, Factur-X/CII), PURE.
 *
 * La norme veut que le total de TVA (BT-110) soit la somme des montants par
 * taux (BT-117). Deux arrondis légitimes existent pour une facture :
 *  - par taux : la base de chaque taux est sommée, puis la TVA arrondie ;
 *  - par ligne : la TVA de chaque ligne est arrondie, puis sommée.
 * Ils diffèrent d'un centime dès que plusieurs lignes portent des fractions de
 * centime. L'export recalculait un troisième chiffre (somme globale, un seul
 * arrondi) : une facture juste, arrondie par ligne ou à deux taux, était
 * refusée (« le total TVA ne correspond pas aux lignes »), ou sortait avec des
 * montants par taux dont la somme n'était pas le total.
 *
 * La ventilation retenue est celle dont la somme égale le total enregistré de
 * la facture ; `null` si aucune des deux ne le retrouve.
 */
export type LigneTva = { netAmount: number; vatRate: number }
export type VentilationTva = { taux: number; base: number; tva: number }[]

const centimes = (valeur: number): number => Math.round(valeur * 100)

export function ventilerTvaParTaux(lignes: LigneTva[], totalTva: number): VentilationTva | null {
  const parTaux = new Map<number, { base: number; brut: number; parLigne: number }>()
  for (const ligne of lignes) {
    const cumul = parTaux.get(ligne.vatRate) ?? { base: 0, brut: 0, parLigne: 0 }
    const tva = (ligne.netAmount * ligne.vatRate) / 100
    cumul.base += ligne.netAmount
    cumul.brut += tva
    cumul.parLigne += centimes(tva)
    parTaux.set(ligne.vatRate, cumul)
  }
  const taux = [...parTaux.entries()].sort((a, b) => a[0] - b[0])
  const attendu = centimes(totalTva)
  const methodes: ((c: { brut: number; parLigne: number }) => number)[] = [
    (c) => centimes(c.brut),
    (c) => c.parLigne,
  ]
  for (const methode of methodes) {
    if (taux.reduce((somme, [, c]) => somme + methode(c), 0) !== attendu) continue
    return taux.map(([t, c]) => ({ taux: t, base: centimes(c.base) / 100, tva: methode(c) / 100 }))
  }
  return null
}
