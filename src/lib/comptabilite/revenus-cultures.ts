import prisma from '@/lib/prisma'
import { ajouterQuantite, type QuantiteParUnite } from '@/lib/recolte/quantites'
import type { UniteQuantite } from '@/lib/recolte/projection'

export interface RevenuCulture {
  revenus: number
  quantiteVendueParUnite: QuantiteParUnite
}

/** Vente directe ou facture : un seul revenu, à sa date de vente/émission.
 * Les BL non facturés et les retours physiques ne sont pas des revenus.
 * Une ligne libre sans lien technique reste non affectée à une culture. */
export async function chargerRevenusCultures(userId: string, debut: Date, fin: Date) {
  const [directes, factures] = await Promise.all([
    prisma.recolte.findMany({
      where: { userId, statut: 'vendu', factureId: null, dateVente: { gte: debut, lte: fin } },
      select: { cultureId: true, quantite: true, unite: true, prixKg: true, prixTotal: true },
    }),
    prisma.facture.findMany({
      where: { userId, date: { gte: debut, lte: fin }, statut: { notIn: ['annulee', 'brouillon'] } },
      select: { id: true, type: true, totalTTC: true, factureOrigineId: true,
        lignes: { select: { articleStockType: true, articleStockId: true, quantite: true, unite: true, montantTTC: true } },
      },
    }),
  ])
  const idsFactures = [...new Set(factures.flatMap(f => [f.id, ...(f.factureOrigineId ? [f.factureOrigineId] : [])]))]
  const idsLots = [...new Set(factures.flatMap(f => f.lignes)
    .filter(l => l.articleStockType === 'recolte' && /^[1-9]\d*$/.test(l.articleStockId ?? ''))
    .map(l => Number(l.articleStockId)))]
  const lots = idsFactures.length || idsLots.length ? await prisma.recolte.findMany({
    where: { userId, OR: [...(idsFactures.length ? [{ factureId: { in: idsFactures } }] : []), ...(idsLots.length ? [{ id: { in: idsLots } }] : [])] },
    select: { id: true, cultureId: true, factureId: true, quantite: true, unite: true, prixTotal: true, prixKg: true },
  }) : []
  const parLot = new Map(lots.map(l => [String(l.id), l]))
  const legacyParFacture = new Map<number, typeof lots>()
  for (const lot of lots) {
    if (lot.factureId == null) continue
    const lies = legacyParFacture.get(lot.factureId) ?? []
    lies.push(lot); legacyParFacture.set(lot.factureId, lies)
  }
  const resultat = new Map<number, RevenuCulture>()
  const ajouter = (cultureId: number, revenus: number, quantite = 0, unite: string | null = 'kg') => {
    const r = resultat.get(cultureId) ?? { revenus: 0, quantiteVendueParUnite: {} }
    r.revenus += revenus
    if (quantite) ajouterQuantite(r.quantiteVendueParUnite, (unite ?? 'kg') as UniteQuantite, quantite)
    resultat.set(cultureId, r)
  }
  for (const r of directes) ajouter(r.cultureId, r.prixTotal || r.quantite * (r.prixKg ?? 0), r.quantite, r.unite)
  for (const f of factures) {
    const signe = f.type === 'avoir' ? -1 : 1
    const liees = f.lignes.filter(l => l.articleStockType === 'recolte')
    if (liees.length) {
      for (const l of liees) {
        const lot = parLot.get(l.articleStockId ?? '')
        if (lot) ajouter(lot.cultureId, signe * l.montantTTC, l.unite === (lot.unite ?? 'kg') ? signe * l.quantite : 0, lot.unite)
      }
      continue
    }
    // Ancienne vente directe facturée : factureId sur la récolte, sans ligne
    // de stock. Un avoir corrige la recette mais n'invente pas de retour.
    const legacy = legacyParFacture.get(f.type === 'avoir' ? f.factureOrigineId ?? -1 : f.id) ?? []
    if (f.lignes.some(l => l.articleStockType)) continue
    if (legacy.length === 1) {
      const lot = legacy[0]
      ajouter(lot.cultureId, signe * f.totalTTC, f.type === 'avoir' ? 0 : lot.quantite, lot.unite)
    } else if (legacy.length > 1 && f.type !== 'avoir') {
      const somme = legacy.reduce((s,l) => s + (l.prixTotal || l.quantite * (l.prixKg ?? 0)), 0)
      // Sans égalité de montants, on n'invente aucune répartition.
      if (Math.abs(somme - f.totalTTC) < 0.005) for (const lot of legacy) {
        ajouter(lot.cultureId, lot.prixTotal || lot.quantite * (lot.prixKg ?? 0), lot.quantite, lot.unite)
      }
    }
  }
  return resultat
}
