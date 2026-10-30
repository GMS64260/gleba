import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { chargerAvertissementsDarFruits } from '@/lib/verger/dar'
import { dateIsoFacture } from '@/lib/facture-regles'
import { chargerPrixVentesMoyens, prixProposeDeVente, valoriserLot } from '@/lib/recolte/valorisation'
import { computeStockOeufsParLots } from '@/lib/elevage/stock-oeufs-lots'
import { calculerStocksRuche } from '@/lib/elevage/stock-ruche'
import { PRODUITS_RUCHE_LABELS, tauxTvaProduitRucheParDefaut } from '@/lib/elevage/produits-ruche'
import { stockDuLotFromage } from '@/lib/elevage/stock-fromage'
import { disponibleCommercial, quantiteBois, type ArticleStockCommercial } from './stock-types'
import { TAUX_TVA_BOIS_PAR_DEFAUT } from '@/lib/verger/tva-bois'
import { indisponibiliteLotVerger } from '@/lib/verger/disponibilite-lot'
import { finJourLivraison } from './dates-stock'

export type DbStockCommercial = Prisma.TransactionClient

/**
 * Seulement des stocks du tenant, jamais les projections de cultures ou les prix de référence.
 *
 * Un lot existe à la date d'effet s'il a été produit ce jour civil (Paris) ou
 * avant, pour tous les ateliers. Revue du 2026-10-29 : un document passe midi
 * UTC de son jour ; une récolte maraîchère ou une ponte horodatée à l'instant
 * réel de sa saisie (tableau de bord, tâches, accueil, assistant) disparaissait
 * l'après-midi du BL du jour même.
 */
export async function chargerCatalogueStock(userId: string, db: DbStockCommercial = prisma, maintenant = new Date()): Promise<ArticleStockCommercial[]> {
  const finJour = finJourLivraison(maintenant)
  const [recoltes, fruits, bois, produits, oeufs, ruches, fromages, prixRecoltes, ventes] = await Promise.all([
    db.recolte.findMany({ where: { userId, statut: 'en_stock', date: { lte: finJour }, produitsBoutique: { none: {} } }, include: { espece: { select: { id: true, nom: true, prixKg: true, userId: true, uniteRendement: true } }, culture: { select: { variete: { select: { nom: true } } } } }, orderBy: [{ date: 'asc' }, { id: 'asc' }] }),
    db.recolteArbre.findMany({ where: { userId, statut: 'en_stock', date: { lte: finJour } }, include: { arbre: { select: { nom: true, espece: true } } }, orderBy: [{ date: 'asc' }, { id: 'asc' }] }),
    db.productionBois.findMany({ where: { userId, statut: 'en_stock', date: { lte: finJour } }, orderBy: [{ date: 'asc' }, { id: 'asc' }] }),
    db.produitBoutique.findMany({ where: { userId }, include: { recolte: { select: { datePeremption: true } } }, orderBy: { nom: 'asc' } }),
    computeStockOeufsParLots(userId, maintenant, db),
    db.productionRuche.findMany({ where: { userId, date: { lte: finJour } }, include: { mouvementsStock: { select: { quantite: true } } } }),
    db.lotFromage.findMany({ where: { userId, etat: 'pret', dateFabrication: { lte: finJour } }, include: { mouvements: { select: { nbPieces: true, poidsKg: true } } }, orderBy: { dateFabrication: 'asc' } }),
    chargerPrixVentesMoyens(db, userId),
    db.venteProduit.findMany({ where: { userId, annule: false }, orderBy: { date: 'desc' }, take: 100, select: { type: true, unite: true, prixUnitaire: true, lotFromageId: true } }),
  ])
  const jour = dateIsoFacture(maintenant)
  const frais = (date: Date | null) => !date || dateIsoFacture(date) >= jour
  const articles: ArticleStockCommercial[] = []
  for (const r of recoltes) {
    const dispo = disponibleCommercial(r)
    if (dispo <= 0 || !frais(r.datePeremption)) continue
    const prix = prixProposeDeVente(valoriserLot({ acteurId: userId, especeId: r.especeId, unite: r.unite, quantite: dispo, prixLot: r.prixKg, espece: r.espece }, prixRecoltes))
    articles.push({ type: 'recolte', id: String(r.id), nom: `${r.espece.nom || r.especeId}${r.culture.variete?.nom ? ` · ${r.culture.variete.nom}` : ''}`, categorie: 'Récoltes maraîchères', disponible: dispo, unite: r.unite || 'kg', prixTTC: prix, tauxTVA: 5.5, statutBio: r.statutBioSnapshot, dateLot: dateIsoFacture(r.date), href: '/maraichage/recoltes' })
  }
  const avertissementsFruits = await chargerAvertissementsDarFruits(db, userId, fruits)
  for (const r of fruits) {
    const dispo = disponibleCommercial(r)
    if (dispo <= 0 || indisponibiliteLotVerger(r, maintenant)) continue
    articles.push({ type: 'fruit', id: String(r.id), nom: `${r.arbre.espece || 'Fruits'} · ${r.arbre.nom || `Arbre ${r.arbreId}`}`, categorie: 'Récoltes du verger', disponible: dispo, unite: 'kg', prixTTC: r.prixKg, tauxTVA: 5.5, statutBio: r.statutBioSnapshot, dateLot: dateIsoFacture(r.date), href: `/verger/${r.arbreId}`, avertissements: avertissementsFruits.get(r.id) })
  }
  for (const b of bois) {
    const q = quantiteBois(b); const dispo = b.stockDisponibleCommercial ?? q.quantite
    if (dispo <= 0 || indisponibiliteLotVerger(b, maintenant)) continue
    articles.push({ type: 'bois', id: String(b.id), nom: `${b.qualiteBois || 'Bois'}${b.numLot ? ` · ${b.numLot}` : ''}`, categorie: 'Bois', disponible: dispo, unite: q.unite, prixTTC: b.prixVente && q.quantite > 0 ? b.prixVente / q.quantite : null, tauxTVA: TAUX_TVA_BOIS_PAR_DEFAUT, statutBio: null, dateLot: dateIsoFacture(b.date), href: '/verger?tab=productions' })
  }
  for (const p of produits) {
    if ((p.stockDispo != null && p.stockDispo <= 0) || !frais(p.recolte?.datePeremption ?? null)) continue
    articles.push({ type: 'boutique', id: String(p.id), nom: p.nom, categorie: p.actif ? 'Catalogue de la boutique' : 'Catalogue hors ligne', disponible: p.stockDispo, unite: p.unite, prixTTC: p.prix, tauxTVA: p.categorie === 'autre' ? 20 : 5.5, statutBio: p.statutBio, href: '/boutique?tab=produits' })
  }
  const oeufsDisponibles = oeufs.data.filter((lot) => lot.statut === 'commercialisable' && lot.datePonte <= finJour).reduce((s, lot) => s + lot.restant, 0)
  if (oeufsDisponibles > 0) {
    const derniere = ventes.find((v) => v.type === 'oeufs' && ['unite', 'unité'].includes(v.unite))
    articles.push({ type: 'oeufs', id: 'stock', nom: 'Œufs commercialisables', categorie: 'Élevage', disponible: oeufsDisponibles, unite: 'pièce', prixTTC: derniere?.prixUnitaire ?? null, tauxTVA: 5.5, statutBio: null, href: '/elevage?tab=production&sub=oeufs' })
  }
  for (const r of calculerStocksRuche(ruches)) {
    if (r.disponible <= 0) continue
    const prix = ventes.find((v) => v.type === (r.produit === 'autre' ? 'autre_ruche' : r.produit) && v.unite === r.unite)?.prixUnitaire ?? null
    articles.push({ type: 'ruche', id: r.produit, nom: PRODUITS_RUCHE_LABELS[r.produit], categorie: 'Produits de la ruche', disponible: r.disponible, unite: r.unite, prixTTC: prix, tauxTVA: tauxTvaProduitRucheParDefaut(r.produit), statutBio: null, href: '/elevage?tab=production&sub=ruche' })
  }
  for (const f of fromages) {
    const stock = stockDuLotFromage(f)
    if (stock.restantPieces <= 0 || !frais(f.dlc) || !frais(f.dluo)) continue
    const prix = ventes.find((v) => v.lotFromageId === f.id && ['piece', 'pièce', 'unite', 'unité'].includes(v.unite))?.prixUnitaire ?? null
    articles.push({ type: 'fromage', id: f.id, nom: `${f.typeFromage} · ${f.numeroLot}`, categorie: 'Fromages prêts', disponible: stock.restantPieces, unite: 'pièce', prixTTC: prix, tauxTVA: 5.5, statutBio: f.statutBioSnapshot, href: '/elevage?tab=production&sub=fromage' })
  }
  return articles
}
