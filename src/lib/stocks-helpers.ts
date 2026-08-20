/**
 * Helpers pour la gestion des stocks (multi-tenancy via UserStock*)
 * Calcul du stock net = Inventaire + Récoltes - Consommations
 */

import prisma from '@/lib/prisma'
import { arrondiQuantiteStock } from '@/lib/stocks/agregation'
import { uniteQuantiteRecolte, type UniteQuantite } from '@/lib/recolte/projection'
import { ajouterQuantite, arrondirQuantites, type QuantiteParUnite } from '@/lib/recolte/quantites'
import { chargerSurchargesRendement, rendementEffectif } from '@/lib/recolte/rendement-effectif'

/**
 * Nombre d'œufs par unité de vente. QA cmsjioqg — le conditionnement n'était
 * converti que pour « douzaine » (×12), à deux endroits avec un multiplicateur
 * en dur : une vente en « boîte » (de 6) comptait 1 œuf, donc le stock vendu
 * était sous-estimé et le prix/œuf surévalué. Constante partagée entre le
 * décompte de stock (`calculerStockOeufs`) et la valorisation (route stocks).
 */
export const OEUFS_PAR_UNITE: Record<string, number> = {
  unite: 1,
  'demi-douzaine': 6,
  'boîte': 6, // boîte standard de 6 (convention du catalogue)
  boite: 6,
  douzaine: 12,
  plaque: 30,
  plateau: 30,
}

/** Nombre d'œufs représentés par une quantité dans une unité de vente donnée. */
export function oeufsDepuisUnite(quantite: number, unite: string | null | undefined): number {
  const parUnite = OEUFS_PAR_UNITE[(unite || '').trim().toLowerCase()] ?? 1
  return quantite * parUnite
}

export interface StockNet {
  stockNet: number
  /**
   * Unité du stock — celle de l'espèce chez cet utilisateur (2026-08-20).
   * Un stock de fleurs coupées se compte en tiges, une salade à la pièce : le
   * nombre seul ne dit plus rien, et l'écran l'étiquetait « kg » en dur.
   */
  unite: UniteQuantite
  detail: {
    inventaire: number
    recoltes: number
    consommations: number
  }
  /**
   * Récoltes en stock enregistrées dans une AUTRE unité que l'unité courante.
   * Cas réel mais rare : l'espèce a changé d'unité en cours de saison, et les
   * lignes antérieures gardent la leur (l'unité est figée à la saisie). On les
   * expose à part plutôt que de les additionner à tort ou de les perdre.
   */
  autresUnites: QuantiteParUnite
}

/**
 * Calcule le stock net pour une ou plusieurs especes (per-user)
 * Stock net = Inventaire (à date inventaire) + Σ Récoltes - Σ Consommations
 */
export async function calculerStocksNet(
  userId: string,
  especeId?: string
): Promise<Record<string, StockNet>> {

  // Récupérer les stocks per-user pour les especes concernées
  const userStocks = await prisma.userStockEspece.findMany({
    where: {
      userId,
      ...(especeId && { especeId }),
    },
    select: {
      especeId: true,
      inventaire: true,
      dateInventaire: true,
    },
  })

  // Si aucun stock per-user, chercher les especes avec des recoltes/consommations
  const especeIds = userStocks.map(us => us.especeId)
  const additionalEspeces = await prisma.espece.findMany({
    where: {
      ...(especeId && { id: especeId }),
      id: { notIn: especeIds },
      OR: [
        { recoltes: { some: { userId } } },
        { consommations: { some: { userId } } },
      ],
    },
    select: { id: true },
  })

  const allEspeces = [
    ...userStocks.map(us => ({
      id: us.especeId,
      inventaire: us.inventaire,
      dateInventaire: us.dateInventaire,
    })),
    ...additionalEspeces.map(e => ({
      id: e.id,
      inventaire: null as number | null,
      dateInventaire: null as Date | null,
    })),
  ]

  // Unité de chaque espèce : celle déclarée par la ferme si elle l'a fait,
  // celle du catalogue sinon.
  const [especesUnite, surcharges] = await Promise.all([
    prisma.espece.findMany({
      where: { id: { in: allEspeces.map(e => e.id) } },
      select: { id: true, rendement: true, uniteRendement: true },
    }),
    chargerSurchargesRendement(userId, allEspeces.map(e => e.id)),
  ])
  const uniteParEspece = new Map(
    especesUnite.map(e => [
      e.id,
      uniteQuantiteRecolte(rendementEffectif(e, surcharges.get(e.id)).uniteRendement),
    ]),
  )

  // Audit 2026-07 (#51) : une récolte « mise en vente » dans la boutique (liée
  // à un ProduitBoutique actif) est committée à la boutique — son stock est
  // suivi par ProduitBoutique.stockDispo. On l'EXCLUT du stock physique loose
  // pour ne pas la compter deux fois (avant, elle restait « en stock » même
  // après avoir été vendue en ligne).
  const produitsBoutique = await prisma.produitBoutique.findMany({
    where: { userId, actif: true, recolteId: { not: null } },
    select: { recolteId: true },
  })
  const recolteIdsEnBoutique = produitsBoutique
    .map(p => p.recolteId)
    .filter((id): id is number => id != null)

  const result: Record<string, StockNet> = {}

  for (const espece of allEspeces) {
    // Modèle « baseline + événements » (refonte stock 2026-07).
    // `inventaire`/`dateInventaire` = POINT DE COMPTAGE MANUEL (null si jamais
    // fait). Le stock net est recalculé ici comme UNIQUE source de vérité :
    //   net = baseline + Σ récoltes en stock APRÈS le comptage − Σ conso APRÈS.
    // Les événements AVANT le comptage sont déjà reflétés dans la valeur saisie.
    // Sans comptage manuel : baseline 0 depuis l'epoch → on somme tout.
    // (Avant, l'inventaire était AUSSI incrémenté à chaque récolte puis les
    // récoltes ré-additionnées ici → double comptage, audit #28.)
    const dateRef = espece.dateInventaire || new Date(0)
    const baseline = espece.inventaire || 0

    // Récoltes encore en stock, postérieures au comptage, HORS boutique
    const recoltes = await prisma.recolte.findMany({
      where: {
        especeId: espece.id,
        userId,
        statut: 'en_stock',
        date: { gt: dateRef },
        ...(recolteIdsEnBoutique.length > 0 && { id: { notIn: recolteIdsEnBoutique } }),
      },
      select: { quantite: true, unite: true },
    })
    // Ventilation par unité, puis on ne retient dans le stock que l'unité
    // COURANTE de l'espèce : additionner 12 kg et 120 tiges ne veut rien dire.
    const uniteEspece = uniteParEspece.get(espece.id) ?? 'kg'
    const recoltesParUnite: QuantiteParUnite = {}
    for (const r of recoltes) {
      ajouterQuantite(recoltesParUnite, (r.unite ?? 'kg') as UniteQuantite, r.quantite)
    }
    const totalRecoltes = recoltesParUnite[uniteEspece] ?? 0
    const autresUnites: QuantiteParUnite = { ...recoltesParUnite }
    delete autresUnites[uniteEspece]

    // Consommations postérieures au comptage
    const consommations = await prisma.consommation.findMany({
      where: {
        especeId: espece.id,
        userId,
        date: { gt: dateRef },
      },
      select: { quantite: true },
    })
    const totalConso = consommations.reduce((sum, c) => sum + c.quantite, 0)

    result[espece.id] = {
      // QA cmswu8uva — arrondi métier : la somme flottante affichait
      // « 10.799999999999999 kg » à l'écran Stocks > Récoltes.
      stockNet: arrondiQuantiteStock(baseline + totalRecoltes - totalConso),
      unite: uniteEspece,
      detail: {
        inventaire: baseline,
        recoltes: totalRecoltes,
        consommations: totalConso,
      },
      autresUnites: arrondirQuantites(autresUnites),
    }
  }

  return result
}

/**
 * Calcule le stock d'oeufs disponible pour un utilisateur
 * Stock = Produits - Cassés - Souillés - Vendus
 *
 * Bug cmp8rw40u (Marc 2026-05-16) — les œufs souillés étaient saisis
 * mais jamais sortis du stock, donc "stock œufs == production" même
 * quand l'éleveur déclarait des sales. On les soustrait désormais comme
 * les cassés (ils ne sont pas vendables).
 */
export async function calculerStockOeufs(userId: string): Promise<{
  stockNet: number
  detail: { produits: number; casses: number; sales: number; vendus: number }
}> {
  const production = await prisma.productionOeuf.aggregate({
    where: { userId },
    _sum: { quantite: true, casses: true, sales: true },
  })

  const produits = production._sum.quantite || 0
  const casses = production._sum.casses || 0
  const sales = production._sum.sales || 0

  // Total vendus (normalisation d'unité : douzaine -> x12)
  const ventes = await prisma.venteProduit.findMany({
    // Revue élevage 2026-07-21 — exclure les ventes annulées (soft-delete),
    // sinon leurs œufs restent déduits du stock à perpétuité.
    where: { userId, type: 'oeufs', annule: false },
    select: { quantite: true, unite: true },
  })

  const vendus = ventes.reduce((sum, v) => sum + oeufsDepuisUnite(v.quantite, v.unite), 0)

  return {
    stockNet: produits - casses - sales - vendus,
    detail: { produits, casses, sales, vendus },
  }
}
