import type { Prisma } from '@prisma/client'
import { chargerCatalogueStock } from '@/lib/commercial/catalogue-stock'
import { convertirQuantiteProduitRuche } from '@/lib/elevage/stock-ruche'
import { uniteProduitRucheParDefaut, type ProduitRuche } from '@/lib/elevage/produits-ruche'
import { cleStockLie, lireStockLie, quantiteStockLie, stockLieRetenu, type ChampsStockLie } from './stock-lie'

export type SortieStockManquante = { ligneId: number; nom: string; demande: number; disponible: number; unite: string | null }
type Mouvement = { commandeBoutiqueId: number | null; articleStockType: string; articleStockId: string; quantite: number; unite: string }
type Ligne = ChampsStockLie & { commandeId: number; quantite: number; mouvementsStock: Mouvement[] }

/** Quantité physique restant à sortir, en unité du stock figé (retours déduits). */
export function quantiteRestantASortir(ligne: Ligne): number {
  const lie = lireStockLie(ligne)
  if (!lie) return 0
  const unite = lie.type === 'oeufs' ? 'pièce' : uniteProduitRucheParDefaut(lie.ref as ProduitRuche)
  let sorti = 0
  for (const m of ligne.mouvementsStock) {
    if (m.commandeBoutiqueId !== ligne.commandeId || m.articleStockType !== lie.type || m.articleStockId !== lie.ref) continue
    if (m.unite === unite) sorti += m.quantite
    else if (lie.type === 'ruche' && (m.unite === 'kg' || m.unite === 'g') && (unite === 'kg' || unite === 'g')) {
      sorti += convertirQuantiteProduitRuche(m.quantite, m.unite, unite)
    }
  }
  return Math.max(0, Math.round((quantiteStockLie(ligne.quantite, lie.conditionnement) - Math.max(0, sorti)) * 1000) / 1000)
}

/**
 * Projection producteur, sans écriture. Le lien de la ligne et ses mouvements
 * font foi, même si la fiche a changé ou disparu. Le disponible suit la priorité
 * des commandes du chemin de sortie ; un réapprovisionnement ne vaut pas sortie.
 * L'appelant vérifie l'accès aux ateliers avant de charger cette projection.
 */
export async function projeterSortiesStockManquantes(
  db: Prisma.TransactionClient, userId: string, commandeIds: number[],
): Promise<Map<number, SortieStockManquante[]>> {
  const resultat = new Map<number, SortieStockManquante[]>()
  if (!commandeIds.length) return resultat
  const lignes = await db.ligneCommandeBoutique.findMany({
    where: {
      commande: { userId, id: { in: commandeIds }, paiementStatut: 'Confirmé', statut: { not: 'annulee' } },
      stockLieType: { not: null }, OR: [{ stockLieMode: null }, { stockLieMode: 'stock' }],
    },
    select: {
      id: true, commandeId: true, nom: true, quantite: true,
      stockLieType: true, stockLieRef: true, stockLieConditionnement: true,
      commande: { select: { id: true, createdAt: true } },
      mouvementsStock: {
        where: { userId, stockSuivi: true },
        select: { commandeBoutiqueId: true, articleStockType: true, articleStockId: true, quantite: true, unite: true },
      },
    },
    orderBy: { id: 'asc' },
  })
  const manquantes = lignes.flatMap(ligne => {
    const lie = lireStockLie(ligne), demande = quantiteRestantASortir(ligne)
    return lie && demande > 0 ? [{ ligne, lie, demande }] : []
  })
  if (!manquantes.length) return resultat
  const catalogue = new Map((await chargerCatalogueStock(userId, db)).map(a => [`${a.type}:${a.id}`, a]))
  const retenues = new Map<number, Map<string, number>>()
  const consomme = new Map<number, Map<string, number>>()
  for (const { ligne, lie, demande } of manquantes) {
    if (!retenues.has(ligne.commandeId)) retenues.set(ligne.commandeId, await stockLieRetenu(db, userId, ligne.commande))
    const cle = cleStockLie(lie), article = catalogue.get(cle)
    const propre = consomme.get(ligne.commandeId) ?? new Map<string, number>()
    const disponible = Math.max(0, Math.round(((article?.disponible ?? 0) - (retenues.get(ligne.commandeId)!.get(cle) ?? 0) - (propre.get(cle) ?? 0)) * 1000) / 1000)
    const anomalies = resultat.get(ligne.commandeId) ?? []
    anomalies.push({ ligneId: ligne.id, nom: ligne.nom, demande, disponible, unite: article?.unite ?? null })
    resultat.set(ligne.commandeId, anomalies)
    // Comme la sortie : une ligne insuffisamment couverte ne consomme rien.
    if (demande <= disponible) propre.set(cle, (propre.get(cle) ?? 0) + demande)
    consomme.set(ligne.commandeId, propre)
  }
  return resultat
}
