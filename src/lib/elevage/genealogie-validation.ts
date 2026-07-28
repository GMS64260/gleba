export type NoeudParents = {
  id: number
  mereId: number | null
  pereId: number | null
}

export type ChargerParents = (ids: number[]) => Promise<NoeudParents[]>

/**
 * Vérifie qu'affecter `parentId` à `animalId` ne fait pas de l'animal son
 * propre ascendant. Le parcours n'est pas borné en générations ; `visites`
 * évite les boucles infinies si des données historiques sont déjà corrompues.
 *
 * Un ancêtre commun atteint par plusieurs branches n'est pas un cycle : il est
 * simplement ignoré au second passage.
 */
export async function verifierLienParenteSansCycle(args: {
  animalId: number
  parentId: number
  chargerParents: ChargerParents
}): Promise<boolean> {
  const { animalId, parentId, chargerParents } = args
  if (animalId === parentId) return false

  const visites = new Set<number>()
  let aVisiter = [parentId]

  while (aVisiter.length > 0) {
    if (aVisiter.includes(animalId)) return false
    const lot = [...new Set(aVisiter.filter((id) => !visites.has(id)))]
    if (lot.length === 0) return true
    lot.forEach((id) => visites.add(id))

    const noeuds = await chargerParents(lot)
    const suivants: number[] = []
    for (const noeud of noeuds) {
      for (const ascendant of [noeud.mereId, noeud.pereId]) {
        if (ascendant === animalId) return false
        if (ascendant !== null && !visites.has(ascendant)) suivants.push(ascendant)
      }
    }
    aVisiter = suivants
  }

  return true
}
