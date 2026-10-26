import type { Prisma } from '@prisma/client'
import { chargerCatalogueStock } from './catalogue-stock'
import { cleArticle, stockEstDenombrable, type ReferenceArticleStock } from './stock-types'
import { ErreurCommerciale } from './regles'
import { livraisonFuture, finJourLivraison } from './dates-stock'
import { computeStockOeufsParLots } from '@/lib/elevage/stock-oeufs-lots'
import { sortirStockRuche, verrouillerStockRuche } from '@/lib/elevage/stock-ruche'
import type { ProduitRuche, UniteProduitRuche } from '@/lib/elevage/produits-ruche'
import { recalerEtatLotFromage, verrouillerEtVerifierStockFromage } from '@/lib/elevage/stock-fromage'
import { calculerStocksNet } from '@/lib/stocks-helpers'

type Tx = Prisma.TransactionClient
type Ligne = ReferenceArticleStock & { id?: string | number; description: string; quantite: number; unite: string; statutBio?: string | null }
type Origine = { documentId?: string; factureId?: number; numero: string; date: Date }

export async function verrouillerStockCommercial(tx: Tx, userId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`gleba:stock-commercial:${userId}`}))`
}

/** Le navigateur choisit une référence ; l'appartenance, l'unité et le bio viennent du serveur. */
export async function verifierLignesStock<T extends Ligne>(tx: Tx, userId: string, lignes: T[]): Promise<T[]> {
  if (!lignes.some((l) => l.articleStockType || l.articleStockId)) return lignes
  const catalogue = new Map((await chargerCatalogueStock(userId, tx)).map((a) => [cleArticle(a), a]))
  return lignes.map((l) => {
    if (!l.articleStockType && !l.articleStockId) return l
    const a = catalogue.get(`${l.articleStockType}:${l.articleStockId}`)
    if (!a) throw new ErreurCommerciale(`Le stock lié à « ${l.description} » n'est plus disponible. Choisissez un autre stock ou une ligne libre.`)
    if (a.unite !== l.unite) throw new ErreurCommerciale(`Conservez l'unité du stock « ${a.nom} » : ${a.unite}.`, 400)
    if (stockEstDenombrable(a.unite) && !Number.isInteger(l.quantite)) throw new ErreurCommerciale(`« ${a.nom} » se compte en quantités entières.`, 400)
    return { ...l, statutBio: a.statutBio }
  })
}

/** Les ressources sont verrouillées avant la séquence de facture, comme les ventes natives. */
export async function verrouillerStocksDesLignes(tx: Tx, userId: string, liees: Ligne[]) {
  if (!liees.some((l) => l.articleStockId)) return
  await verrouillerStockCommercial(tx, userId)
  // Même ordre que les ventes natives (œufs, ruche, cave) pour partager leurs verrous.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`gleba:stock-oeufs:${userId}`}))`
  for (const produit of [...new Set(liees.filter((l) => l.articleStockType === 'ruche').map((l) => l.articleStockId!))].sort()) {
    await verrouillerStockRuche(tx, userId, produit as ProduitRuche)
  }
  for (const id of [...new Set(liees.filter((l) => l.articleStockType === 'fromage').map((l) => l.articleStockId!))].sort()) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`gleba:fromage:${id}`}))`
  }
}

/** Un BL livré OU une facture directe sort le stock ; facturer ce BL ne rappelle jamais cette fonction. */
export async function sortirStockCommercial(tx: Tx, userId: string, lignes: Ligne[], origine: Origine) {
  const liees = lignes.filter((l) => l.articleStockType || l.articleStockId)
  if (!liees.length) return
  if (livraisonFuture(origine.date)) throw new ErreurCommerciale('Une sortie de stock doit correspondre à une livraison réelle, aujourd’hui ou avant. Préparez un devis ou un BL pour une livraison future.', 400)
  await verrouillerStocksDesLignes(tx, userId, liees)
  const deja = await tx.mouvementStockCommercial.count({ where: { userId, ...(origine.documentId ? { documentId: origine.documentId } : { factureId: origine.factureId }), origineRetourId: null } })
  if (deja) return // reprise d'une même livraison / émission
  const dateLimite = finJourLivraison(origine.date)
  const catalogue = new Map((await chargerCatalogueStock(userId, tx)).map((a) => [cleArticle(a), a]))
  for (const l of liees) {
    const a = catalogue.get(`${l.articleStockType}:${l.articleStockId}`)
    if (!a) throw new ErreurCommerciale(`Stock indisponible pour « ${l.description} ». Actualisez les produits du document.`)
    if (l.unite !== a.unite || !Number.isFinite(l.quantite) || l.quantite <= 0 || (stockEstDenombrable(a.unite) && !Number.isInteger(l.quantite))) throw new ErreurCommerciale(`Quantité ou unité invalide pour « ${a.nom} ».`, 400)
    if (a.disponible != null && l.quantite > a.disponible + 1e-6) throw new ErreurCommerciale(`Stock insuffisant : ${a.nom}, ${a.disponible} ${a.unite} disponible(s), ${l.quantite} demandé(s).`)
    const trace: Prisma.MouvementStockCommercialUncheckedCreateInput = {
      userId, documentId: origine.documentId, factureId: origine.factureId,
      ligneDocumentId: origine.documentId ? String(l.id) : undefined,
      ligneFactureId: !origine.documentId && l.id != null ? Number(l.id) : undefined,
      articleStockType: a.type, articleStockId: a.id, sourceNom: a.nom, unite: a.unite,
      quantite: l.quantite, date: origine.date,
    }
    const notes = `${origine.numero} · ${l.description}`
    if (a.type === 'recolte' || a.type === 'fruit' || a.type === 'bois') {
      // L'UPDATE conditionnel protège aussi contre une vente issue de l'ancien écran.
      let modifie: number
      if (a.type === 'recolte') {
        const lot = await tx.recolte.findFirstOrThrow({ where: { id: Number(a.id), userId } })
        const net = (await calculerStocksNet(userId, lot.especeId, tx))[lot.especeId]
        const disponibleNet = net?.unite === a.unite ? net.stockNet : net?.autresUnites[a.unite as keyof typeof net.autresUnites]
        if (disponibleNet != null && l.quantite > disponibleNet + 1e-6) throw new ErreurCommerciale(`Le stock net de ${a.nom} est de ${disponibleNet} ${a.unite} après inventaire et consommations. Rapprochez vos lots avant cette livraison.`)
        modifie = await tx.$executeRaw`UPDATE recoltes SET stock_disponible_commercial = COALESCE(stock_disponible_commercial, quantite) - ${l.quantite} WHERE id = ${Number(a.id)} AND user_id = ${userId} AND statut = 'en_stock' AND date <= ${dateLimite} AND NOT EXISTS (SELECT 1 FROM produits_boutique p WHERE p.user_id = ${userId} AND p.recolte_id = ${Number(a.id)}) AND COALESCE(stock_disponible_commercial, quantite) >= ${l.quantite}`
        trace.recolteId = Number(a.id)
      } else if (a.type === 'fruit') {
        modifie = await tx.$executeRaw`UPDATE recoltes_arbres SET stock_disponible_commercial = COALESCE(stock_disponible_commercial, quantite) - ${l.quantite} WHERE id = ${Number(a.id)} AND user_id = ${userId} AND statut = 'en_stock' AND date <= ${dateLimite} AND COALESCE(stock_disponible_commercial, quantite) >= ${l.quantite}`
        trace.fruitId = Number(a.id)
      } else {
        modifie = await tx.$executeRaw`UPDATE production_bois SET stock_disponible_commercial = COALESCE(stock_disponible_commercial, volume_stere, volume_m3, poids_kg, 0) - ${l.quantite} WHERE id = ${Number(a.id)} AND user_id = ${userId} AND statut = 'en_stock' AND date <= ${dateLimite} AND COALESCE(stock_disponible_commercial, volume_stere, volume_m3, poids_kg, 0) >= ${l.quantite}`
        trace.boisId = Number(a.id)
      }
      if (!modifie) throw new ErreurCommerciale(`Le lot « ${a.nom} » a changé ou n'existait pas à la date de livraison. Actualisez le document.`)
    } else if (a.type === 'boutique') {
      const lignes = await tx.$queryRaw<Array<{ stock_dispo: number | null }>>`UPDATE produits_boutique SET stock_dispo = CASE WHEN stock_dispo IS NULL THEN NULL ELSE stock_dispo - ${l.quantite} END WHERE id = ${Number(a.id)} AND user_id = ${userId} AND (stock_dispo IS NULL OR stock_dispo >= ${l.quantite}) RETURNING stock_dispo`
      if (!lignes.length) throw new ErreurCommerciale(`Le stock boutique de « ${a.nom} » a changé. Actualisez le document.`)
      trace.produitBoutiqueId = Number(a.id); trace.stockSuivi = lignes[0].stock_dispo != null
    } else if (a.type === 'oeufs') {
      let restant = l.quantite
      const lots = await computeStockOeufsParLots(userId, new Date(), tx)
      for (const lot of lots.data.filter((p) => p.statut === 'commercialisable' && p.datePonte <= dateLimite)) {
        if (restant <= 0) break
        const quantite = Math.min(restant, lot.restant)
        const m = await tx.mouvementStockOeuf.create({ data: { userId, productionId: lot.id, date: origine.date, type: 'vente', quantite, notes } })
        await tx.mouvementStockCommercial.create({ data: { ...trace, quantite, ponteId: lot.id, mouvementOeufId: m.id } })
        restant -= quantite
      }
      if (restant > 0) throw new ErreurCommerciale('Stock d’œufs commercialisables insuffisant à cette date.')
    } else if (a.type === 'ruche') {
      const operationId = await sortirStockRuche(tx, { userId, produit: a.id as ProduitRuche, unite: a.unite as UniteProduitRuche, date: dateLimite, quantite: l.quantite, type: 'vente', notes })
      const mouvements = await tx.mouvementStockRuche.findMany({ where: { userId, operationId }, include: { production: { select: { unite: true } } } })
      for (const m of mouvements) await tx.mouvementStockCommercial.create({ data: { ...trace, rucheId: m.productionId, mouvementRucheId: m.id, quantite: m.quantite, unite: m.production.unite } })
    } else if (a.type === 'fromage') {
      const { stock } = await verrouillerEtVerifierStockFromage(tx, userId, a.id, l.quantite, 0)
      const poidsKg = stock.restantPieces > 0 ? stock.restantKg * l.quantite / stock.restantPieces : 0
      const m = await tx.mouvementFromage.create({ data: { userId, lotFromageId: a.id, date: origine.date, type: 'sortie_vente', nbPieces: l.quantite, poidsKg, notes } })
      trace.fromageId = a.id; trace.mouvementFromageId = m.id; trace.poidsKg = poidsKg
      await recalerEtatLotFromage(tx, userId, a.id, 'sortie')
    }
    if (!['oeufs', 'ruche'].includes(a.type)) await tx.mouvementStockCommercial.create({ data: trace })
    if (a.disponible != null) a.disponible = Math.max(0, a.disponible - l.quantite)
  }
}

/** Retour physique explicite, tracé et répétable sans ajouter deux fois les quantités. */
export async function retournerStockCommercial(tx: Tx, userId: string, origine: { documentId?: string; factureId?: number }) {
  await verrouillerStockCommercial(tx, userId)
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`gleba:stock-oeufs:${userId}`}))`
  const mouvements = await tx.mouvementStockCommercial.findMany({ where: { userId, ...origine, origineRetourId: null, retour: null }, orderBy: { id: 'asc' } })
  for (const m of mouvements) {
    if (m.stockSuivi && ![m.recolteId, m.fruitId, m.boisId, m.produitBoutiqueId, m.ponteId, m.rucheId, m.fromageId].some(Boolean)) throw new ErreurCommerciale('Le stock d’origine de ce document n’a pas été transféré dans ce compte. Rapprochez les stocks avant d’enregistrer ce retour.')
    if (m.recolteId) await tx.recolte.update({ where: { id: m.recolteId }, data: { stockDisponibleCommercial: { increment: m.quantite } } })
    if (m.fruitId) await tx.recolteArbre.update({ where: { id: m.fruitId }, data: { stockDisponibleCommercial: { increment: m.quantite } } })
    if (m.boisId) await tx.productionBois.update({ where: { id: m.boisId }, data: { stockDisponibleCommercial: { increment: m.quantite } } })
    if (m.produitBoutiqueId && m.stockSuivi) await tx.produitBoutique.updateMany({ where: { id: m.produitBoutiqueId, stockDispo: { not: null } }, data: { stockDispo: { increment: m.quantite } } })
    const data: Prisma.MouvementStockCommercialUncheckedCreateInput = {
      userId, documentId: m.documentId, factureId: m.factureId, ligneDocumentId: m.ligneDocumentId, ligneFactureId: m.ligneFactureId,
      origineRetourId: m.id, articleStockType: m.articleStockType, articleStockId: m.articleStockId, sourceNom: m.sourceNom,
      quantite: -m.quantite, unite: m.unite, poidsKg: m.poidsKg == null ? null : -m.poidsKg, stockSuivi: m.stockSuivi,
      recolteId: m.recolteId, fruitId: m.fruitId, boisId: m.boisId, produitBoutiqueId: m.produitBoutiqueId, ponteId: m.ponteId, rucheId: m.rucheId, fromageId: m.fromageId,
    }
    const notes = 'Retour en stock du document commercial'
    if (m.ponteId) data.mouvementOeufId = (await tx.mouvementStockOeuf.create({ data: { userId, productionId: m.ponteId, type: 'retour_commercial', quantite: -m.quantite, notes } })).id
    if (m.rucheId) {
      await verrouillerStockRuche(tx, userId, m.articleStockId as ProduitRuche)
      data.mouvementRucheId = (await tx.mouvementStockRuche.create({ data: { userId, productionId: m.rucheId, operationId: `retour:${m.id}`, type: 'retour_commercial', quantite: -m.quantite, notes } })).id
    }
    if (m.fromageId) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`gleba:fromage:${m.fromageId}`}))`
      data.mouvementFromageId = (await tx.mouvementFromage.create({ data: { userId, lotFromageId: m.fromageId, date: new Date(), type: 'retour_commercial', nbPieces: -m.quantite, poidsKg: -(m.poidsKg ?? 0), notes } })).id
      await recalerEtatLotFromage(tx, userId, m.fromageId, 'retour')
    }
    await tx.mouvementStockCommercial.create({ data })
  }
}
