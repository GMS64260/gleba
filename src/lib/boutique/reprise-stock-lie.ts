/**
 * Reprise des commandes de la boutique passées AVANT que la boutique sache
 * vendre un stock de l'élevage. L'absence de lien ne prouve pas l'absence
 * d'une sortie manuelle ou d'un ajustement ayant déjà couvert la commande.
 *
 * Par règle, sans rien deviner :
 *  1. un produit est relié seul quand sa catégorie et son unité désignent un
 *     conditionnement sans ambiguïté (œufs : douzaine, demi-douzaine, pièce ;
 *     miel : kg, g). Tout autre produit est laissé tel quel et journalisé ;
 *  2. un mouvement natif du même stock sans rattachement certain à une ligne
 *     boutique suspend les lignes historiques, même encore ouvertes : journal `a_rapprocher`,
 *     sans poser leur lien ni toucher leurs mouvements. Ni les dates, ni les
 *     quantités, ni les libellés ne suffisent à rapprocher automatiquement ;
 *  3. hors ambiguïté, le lien est figé et chaque ligne d'une commande déjà
 *     matérialisée (livrée ou payée) sort à sa date, tout ou rien ;
 *  4. si les lots de cette date ne suffisent plus (des ventes saisies depuis
 *     les ont pris), la ligne sort à la date de la reprise, sur le stock
 *     réellement présent, et le journal le dit (`dateDeRepli`). Si ce stock ne
 *     suffit pas non plus, rien n'est forcé : l'écart est journalisé.
 *
 * Aucune vente d'élevage n'est supprimée ni modifiée. Rejouable : une ligne
 * déjà sortie n'est pas sortie deux fois. À blanc par défaut : tout est joué
 * dans la transaction de l'exploitation, puis annulé.
 */
import type { Prisma, PrismaClient } from '@prisma/client'
import { sortirStockCommercial, verrouillerStocksDesLignes } from '@/lib/commercial/stock'
import { ErreurCommerciale } from '@/lib/commercial/regles'
import { PRODUITS_RUCHE } from '@/lib/elevage/produits-ruche'
import { champsStockLie, cleStockLie, lireModeStockLie, lireStockLie, quantiteStockLie, validerStockLie, type StockLie } from './stock-lie'
import { listerStocksLiables } from './stock-lie-disponible'
import { motifBlocageRattachement } from '@/lib/commercial/engagements-rattachement'

type MouvementARapprocher = { source: 'oeufs' | 'ruche'; id: string; productionId: number; type: string; date: string; quantite: number; unite: string }

export type EvenementReprise =
  | { objet: 'produit'; produitId: number; issue: 'relie'; type: string; ref: string; conditionnement: number }
  | { objet: 'produit'; produitId: number; issue: 'non_relie'; raison: string }
  | { objet: 'ligne'; commandeId: number; ligneId: number; issue: 'lien_fige' }
  | { objet: 'ligne'; commandeId: number; ligneId: number; issue: 'sortie'; quantite: number; unite: string; date: string; dateDeRepli?: true }
  | { objet: 'ligne'; commandeId: number; ligneId: number; issue: 'deja_sortie' }
  | { objet: 'ligne'; commandeId: number; ligneId: number; issue: 'non_reprise'; raison: 'produit_supprime' | 'unite_modifiee' }
  | { objet: 'ligne'; commandeId: number; ligneId: number; issue: 'a_rapprocher'; stock: string; raison: string }
  | { objet: 'ligne'; commandeId: number; ligneId: number; issue: 'stock_insuffisant'; quantite: number; date: string; detail: string }

export interface JournalReprise {
  userId: string
  applique: boolean
  evenements: EvenementReprise[]
  /** Mouvements référencés une seule fois par stock, quelle que soit la quantité de lignes suspendues. */
  rapprochements: Record<string, MouvementARapprocher[]>
}

/** Conditionnements reconnus sans ambiguïté. Une « boîte » ou une « barquette » n'a pas de contenance fixe. */
const REGLES: Record<string, { type: 'oeufs' | 'ruche'; ref: string; unites: Record<string, number> }> = {
  oeufs: { type: 'oeufs', ref: 'stock', unites: { douzaine: 12, 'demi-douzaine': 6, 'pièce': 1, piece: 1, unite: 1, 'unité': 1 } },
  miel: { type: 'ruche', ref: 'miel', unites: { kg: 1, g: 0.001 } },
}

/** Lien déduit de la catégorie et de l'unité du produit, ou la raison de ne rien déduire. */
export function regleDeRattachement(produit: { categorie: string | null; unite: string; recolteId: number | null; stockDispo: number | null }): { lie: StockLie } | { raison: string } {
  const regle = REGLES[(produit.categorie ?? '').trim().toLowerCase()]
  if (!regle) return { raison: 'catégorie sans stock relié connu' }
  if (produit.recolteId !== null) return { raison: 'produit issu d’une récolte du maraîchage' }
  if (produit.stockDispo !== null) return { raison: 'produit à compteur propre : à relier à la main après passage en stock illimité' }
  const conditionnement = regle.unites[produit.unite.trim().toLowerCase()]
  if (conditionnement === undefined) return { raison: `unité « ${produit.unite} » sans contenance fixe : à relier à la main avec son conditionnement` }
  return { lie: { type: regle.type, ref: regle.ref, conditionnement } }
}

class RepriseABlanc extends Error {}

/** Les verrous natifs doivent être pris avant cette lecture et gardés jusqu'à la fin de la reprise. */
async function mouvementsARapprocher(tx: Prisma.TransactionClient, userId: string) {
  // Seule une trace vers une ligne boutique du compte distingue avec certitude
  // une sortie déjà attribuée. Un BL, une vente d'élevage ou un ajustement peut
  // avoir couvert une commande historique : aucun rapprochement par ressemblance.
  const sansLigneBoutique: Prisma.MouvementStockCommercialListRelationFilter = {
    none: { userId, ligneCommandeBoutique: { commande: { userId } } },
  }
  const [oeufs, ruches] = await Promise.all([
    tx.mouvementStockOeuf.findMany({
      where: { userId, mouvementsCommerciaux: sansLigneBoutique },
      select: { id: true, productionId: true, date: true, type: true, quantite: true }, orderBy: { id: 'asc' },
    }),
    tx.mouvementStockRuche.findMany({
      where: { userId, production: { userId }, mouvementsCommerciaux: sansLigneBoutique },
      select: { id: true, productionId: true, date: true, type: true, quantite: true, production: { select: { produit: true, unite: true } } }, orderBy: { id: 'asc' },
    }),
  ])
  const parStock = new Map<string, MouvementARapprocher[]>()
  if (oeufs.length) parStock.set('oeufs:stock', oeufs.map(m => ({ ...m, source: 'oeufs', date: m.date.toISOString(), unite: 'pièce' })))
  for (const { production, ...m } of ruches) {
    const cle = `ruche:${production.produit}`
    const mouvements = parStock.get(cle) ?? []
    mouvements.push({ ...m, source: 'ruche', date: m.date.toISOString(), unite: production.unite })
    parStock.set(cle, mouvements)
  }
  return parStock
}

/** Reprend une exploitation dans une seule transaction, annulée si `appliquer` est faux. */
export async function reprendreStockLieExploitation(prisma: PrismaClient, userId: string, appliquer = false): Promise<JournalReprise> {
  const evenements: EvenementReprise[] = []
  const rapprochements: JournalReprise['rapprochements'] = {}
  try {
    await prisma.$transaction(async (tx) => {
      // Même ordre que les sorties ordinaires : commercial, œufs, ruches triées.
      // Une sortie manuelle concurrente ne doit pas apparaître entre contrôle et sortie.
      await verrouillerStocksDesLignes(tx, userId, [
        { articleStockType: 'oeufs', articleStockId: 'stock', description: 'Œufs', quantite: 0, unite: 'pièce' },
        ...PRODUITS_RUCHE.map(ref => ({ articleStockType: 'ruche', articleStockId: ref, description: ref, quantite: 0, unite: 'kg' })),
      ])
      const stocks = await listerStocksLiables(tx, userId)
      const ambigus = await mouvementsARapprocher(tx, userId)
      const suspendreSiAmbigu = (commandeId: number, ligneId: number, lie: StockLie) => {
        const stock = cleStockLie(lie)
        const mouvements = ambigus.get(stock)
        if (!mouvements?.length) return false
        rapprochements[stock] = mouvements
        evenements.push({ objet: 'ligne', commandeId, ligneId, issue: 'a_rapprocher', stock,
          raison: 'Des mouvements de ce stock peuvent déjà couvrir cette commande. Voir rapprochements[stock] ; aucune sortie ni attribution automatique.' })
        return true
      }

      // 1. Rattachement des produits, par règle.
      const produits = await tx.produitBoutique.findMany({ where: { userId, stockLieType: null }, orderBy: { id: 'asc' } })
      for (const p of produits) {
        const regle = regleDeRattachement(p)
        if ('raison' in regle) {
          // Les catégories étrangères au chantier ne chargent pas le journal.
          if (REGLES[(p.categorie ?? '').trim().toLowerCase()]) evenements.push({ objet: 'produit', produitId: p.id, issue: 'non_relie', raison: regle.raison })
          continue
        }
        const stock = stocks.find((s) => s.type === regle.lie.type && s.ref === regle.lie.ref)
        // Sans production enregistrée (revente), le produit reste tel quel : le relier ferait passer sa vitrine d'illimité à rupture.
        if (!stock?.produit) { evenements.push({ objet: 'produit', produitId: p.id, issue: 'non_relie', raison: 'aucune production enregistrée pour ce stock' }); continue }
        let lie: StockLie
        try { lie = validerStockLie(regle.lie, stock.unite)! } catch { evenements.push({ objet: 'produit', produitId: p.id, issue: 'non_relie', raison: 'conditionnement incompatible avec l’unité du stock' }); continue }
        const blocage = await motifBlocageRattachement(tx, userId, p.id)
        if (blocage) { evenements.push({ objet: 'produit', produitId: p.id, issue: 'non_relie', raison: blocage }); continue }
        await tx.produitBoutique.update({ where: { id: p.id }, data: champsStockLie(lie) })
        evenements.push({ objet: 'produit', produitId: p.id, issue: 'relie', ...lie })
      }

      // 2. Lien figé sur les lignes encore sans lien des produits reliés.
      // Les produits supprimés sont aussi lus : aucun lien ne peut être déduit,
      // mais leur exclusion doit rester visible, même au prochain passage.
      const aFiger = await tx.ligneCommandeBoutique.findMany({
        where: { stockLieType: null, commande: { userId }, OR: [{ produit: null }, { produit: { userId, stockLieType: { not: null } } }] },
        include: { produit: true, mouvementsStock: { where: { userId, origineRetourId: null }, select: { id: true } } }, orderBy: { id: 'asc' },
      })
      for (const l of aFiger) {
        if (!l.produit) {
          evenements.push({ objet: 'ligne', commandeId: l.commandeId, ligneId: l.id, issue: 'non_reprise', raison: 'produit_supprime' })
          continue
        }
        // L'unité de la ligne est celle du produit à la commande : si elle a changé depuis, le conditionnement actuel ne la décrit plus.
        if (l.unite !== l.produit.unite) {
          evenements.push({ objet: 'ligne', commandeId: l.commandeId, ligneId: l.id, issue: 'non_reprise', raison: 'unite_modifiee' })
          continue
        }
        const lie = lireStockLie(l.produit)
        if (!lie) continue
        // Laisser le lien nul évite qu'un simple rejeu du paiement ou de la
        // livraison sorte ensuite cette ligne historique sans rapprochement,
        // même si son statut n'avait pas été mis à jour après la remise réelle.
        if (!l.mouvementsStock.length && suspendreSiAmbigu(l.commandeId, l.id, lie)) continue
        // Le mode du produit suit le lien : une ligne ouverte d'un produit « à produire » ne doit pas devenir « stock réel ».
        await tx.ligneCommandeBoutique.update({ where: { id: l.id }, data: { ...champsStockLie(lie), stockLieMode: lireModeStockLie(l.produit.stockLieMode) } })
        evenements.push({ objet: 'ligne', commandeId: l.commandeId, ligneId: l.id, issue: 'lien_fige' })
      }

      // 3. Sortie des lignes des commandes déjà matérialisées, à leur date.
      const commandes = await tx.commandeBoutique.findMany({
        where: { userId, statut: { not: 'annulee' }, OR: [{ statut: 'livree' }, { paiementStatut: 'Confirmé' }, { venteManuelleId: { not: null } }], lignes: { some: { stockLieType: { not: null } } } },
        include: { lignes: { where: { stockLieType: { not: null } }, orderBy: { id: 'asc' }, include: { mouvementsStock: { where: { userId, origineRetourId: null }, select: { id: true } } } }, venteManuelle: { select: { date: true } } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      })
      // Tout ou rien par ligne : un refus en cours de FIFO ne laisse aucune écriture.
      const sortir = async (c: (typeof commandes)[number], l: (typeof commandes)[number]['lignes'][number], lie: StockLie, date: Date): Promise<{ quantite: number; unite: string } | { refus: string }> => {
        const stock = stocks.find((s) => s.type === lie.type && s.ref === lie.ref)
        const quantite = quantiteStockLie(l.quantite, lie.conditionnement)
        await tx.$executeRawUnsafe('SAVEPOINT reprise_ligne')
        try {
          if (!stock) throw new ErreurCommerciale('Stock relié introuvable.')
          await sortirStockCommercial(tx, userId, [{ articleStockType: lie.type, articleStockId: lie.ref, id: l.id, description: l.nom, quantite, unite: stock.unite }], { commandeBoutiqueId: c.id, numero: c.numero, date })
          await tx.$executeRawUnsafe('RELEASE SAVEPOINT reprise_ligne')
          return { quantite, unite: stock.unite }
        } catch (e) {
          if (!(e instanceof ErreurCommerciale) && !(e instanceof Error && e.name === 'StockRucheError')) throw e
          await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT reprise_ligne')
          await tx.$executeRawUnsafe('RELEASE SAVEPOINT reprise_ligne')
          return { refus: e.message }
        }
      }
      const jour = (d: Date) => d.toISOString().slice(0, 10)
      // Toutes les lignes d'abord à leur date ; le repli ne vient qu'ensuite,
      // pour ne pas prendre le stock d'une commande que sa propre date sert.
      const enAttente: Array<{ c: (typeof commandes)[number]; l: (typeof commandes)[number]['lignes'][number]; lie: StockLie; date: Date }> = []
      for (const c of commandes) {
        const date = c.venteManuelle?.date ?? c.createdAt
        for (const l of c.lignes) {
          const lie = lireStockLie(l)
          if (!lie) continue
          if (l.mouvementsStock.length) { evenements.push({ objet: 'ligne', commandeId: c.id, ligneId: l.id, issue: 'deja_sortie' }); continue }
          // « À produire » ne sort qu'à la livraison : une commande payée non livrée attend sa production.
          if (lireModeStockLie(l.stockLieMode) === 'a_produire' && c.statut !== 'livree') continue
          if (suspendreSiAmbigu(c.id, l.id, lie)) continue
          const r = await sortir(c, l, lie, date)
          if ('refus' in r) enAttente.push({ c, l, lie, date })
          else evenements.push({ objet: 'ligne', commandeId: c.id, ligneId: l.id, issue: 'sortie', ...r, date: jour(date) })
        }
      }
      const aujourdhui = new Date()
      for (const { c, l, lie, date } of enAttente) {
        const r = await sortir(c, l, lie, aujourdhui)
        if ('refus' in r) evenements.push({ objet: 'ligne', commandeId: c.id, ligneId: l.id, issue: 'stock_insuffisant', quantite: quantiteStockLie(l.quantite, lie.conditionnement), date: jour(date), detail: r.refus })
        else evenements.push({ objet: 'ligne', commandeId: c.id, ligneId: l.id, issue: 'sortie', ...r, date: jour(aujourdhui), dateDeRepli: true })
      }
      if (!appliquer) throw new RepriseABlanc()
    }, { timeout: 120000 })
  } catch (e) {
    if (!(e instanceof RepriseABlanc)) throw e
  }
  return { userId, applique: appliquer, evenements, rapprochements }
}
