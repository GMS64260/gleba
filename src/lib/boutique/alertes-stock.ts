import { lireModeStockLie, lireStockLie, type ChampsStockLie } from './stock-lie'
import { commandableProduitLie, type EtatStockLie } from './stock-lie-disponible'

export interface ProduitPourAlerteStock extends ChampsStockLie {
  id: number
  nom: string
  actif: boolean
  stockDispo: number | null
  unite: string
  categorie: string | null
  stockLieMode: string | null
}

/** Même commandable que le catalogue pour un stock lié ; compteur habituel
 * pour un produit indépendant. `null` interdit la lecture des stocks liés. */
export function classerAlertesStock(produits: readonly ProduitPourAlerteStock[], stocksLies: Map<string, EtatStockLie> | null) {
  const stockBas: Array<{ id: number; nom: string; stockDispo: number; unite: string; categorie: string | null }> = []
  const ruptures: Array<{ id: number; nom: string; categorie: string | null }> = []
  for (const p of produits) {
    if (!p.actif) continue
    let quantite = p.stockDispo
    if (p.stockLieType) {
      const lie = lireStockLie(p)
      if (!lie || !stocksLies || lireModeStockLie(p.stockLieMode) === 'a_produire') continue
      quantite = commandableProduitLie(stocksLies, lie, p.unite, lireModeStockLie(p.stockLieMode))
    }
    if (quantite === null) continue
    if (quantite <= 0) ruptures.push({ id: p.id, nom: p.nom, categorie: p.categorie })
    else if (quantite < 5) stockBas.push({ id: p.id, nom: p.nom, stockDispo: quantite, unite: p.unite, categorie: p.categorie })
  }
  stockBas.sort((a, b) => a.stockDispo - b.stockDispo)
  return { stockBas, ruptures }
}
