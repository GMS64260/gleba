import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import type { VenteCommercialeVerger } from './suivi-commercial-types'
import { deviseFactureReglement } from '@/lib/comptabilite/devise-reglement'

type Nature = 'fruit' | 'bois'
type Ligne = { articleStockType: string | null; articleStockId: string | null; montantTTC: number }
type Facture = { id: number; numero: string; statut: string; type: string; totalTTC: number; date: Date;
  clientNom: string; factureOrigineId: number | null; emetteurSnapshot: unknown; lignes: Ligne[] }
const arrondir = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const active = (f: Facture) => !['brouillon', 'annulee'].includes(f.statut)

/** Les quantités viennent des mouvements ; la recette vient une seule fois de
 * la facture et de ses avoirs. Un retour physique seul ne réduit pas la recette. */
export async function chargerSuiviCommercialVerger(
  userId: string,
  nature: Nature,
  ids: number[],
  db: Prisma.TransactionClient = prisma,
): Promise<Map<number, VenteCommercialeVerger[]>> {
  const resultat = new Map<number, VenteCommercialeVerger[]>()
  if (!ids.length) return resultat
  const mouvements = await db.mouvementStockCommercial.findMany({
    where: { userId, origineRetourId: null, ...(nature === 'fruit' ? { fruitId: { in: ids } } : { boisId: { in: ids } }) },
    select: {
      id: true, fruitId: true, boisId: true, quantite: true, unite: true, date: true, factureId: true,
      document: { select: { id: true, userId: true, numero: true, clientNom: true, factureId: true, emetteurSnapshot: true } },
      ligneDocument: { select: { quantite: true, montantTTC: true } },
      ligneFacture: { select: { quantite: true, montantTTC: true } },
      retour: { select: { userId: true, quantite: true } },
    },
    orderBy: [{ date: 'desc' }, { id: 'asc' }],
  })
  const idsFactures = [...new Set(mouvements.flatMap(m => {
    const id = m.factureId ?? (m.document?.userId === userId ? m.document.factureId : null)
    return id == null ? [] : [id]
  }))]
  const factures = idsFactures.length ? await db.facture.findMany({
    where: { userId, OR: [{ id: { in: idsFactures } }, { type: 'avoir', factureOrigineId: { in: idsFactures } }] },
    select: { id: true, numero: true, statut: true, type: true, totalTTC: true, date: true, clientNom: true, factureOrigineId: true, emetteurSnapshot: true,
      lignes: { select: { articleStockType: true, articleStockId: true, montantTTC: true } } },
  }) : []
  const parFacture = new Map(factures.filter(f => f.type !== 'avoir').map(f => [f.id, f]))
  const groupes = new Map<string, { lotId: number; vente: VenteCommercialeVerger }>()
  for (const m of mouvements) {
    const lotId = nature === 'fruit' ? m.fruitId : m.boisId
    if (lotId == null || m.quantite <= 0) continue
    const document = m.document?.userId === userId ? m.document : null
    const factureId = m.factureId ?? document?.factureId
    const facture = factureId == null ? null : parFacture.get(factureId) ?? null
    if (!document && !facture) continue
    // Plusieurs BL du même lot regroupés sur une facture : une seule recette.
    const cle = `${lotId}:${facture ? 'facture:' + facture.id : 'livraison:' + document!.id}`
    let groupe = groupes.get(cle)
    if (!groupe) {
      groupe = { lotId, vente: { cle, date: (facture?.date ?? m.date).toISOString(), quantiteLivree: 0, quantiteRetournee: 0,
        quantiteNette: 0, unite: m.unite, devise: deviseFactureReglement(facture?.emetteurSnapshot ?? document?.emetteurSnapshot, 'EUR'), montantLivre: 0, revenuTTC: 0, montantAvoirs: 0, documents: [],
        facture: facture ? { id: facture.id, numero: facture.numero, statut: facture.statut } : null,
        clientNom: facture?.clientNom ?? document!.clientNom } }
      if (facture && active(facture)) {
        const duLot = (l: Ligne) => l.articleStockType === nature && l.articleStockId === String(lotId)
        const lignes = facture.lignes.filter(duLot)
        // Une facture commerciale sans lien de ligne ne permet pas d'inventer
        // une ventilation entre plusieurs lots.
        groupe.vente.revenuTTC = lignes.length ? lignes.reduce((s, l) => s + l.montantTTC, 0) : null
        for (const avoir of factures.filter(f => f.type === 'avoir' && f.factureOrigineId === facture.id && active(f))) {
          if (deviseFactureReglement(avoir.emetteurSnapshot, groupe.vente.devise) !== groupe.vente.devise) {
            groupe.vente.revenuTTC = null
            continue
          }
          const liees = avoir.lignes.filter(duLot)
          let montant = liees.reduce((s, l) => s + l.montantTTC, 0)
          const libres = avoir.lignes.filter(l => !l.articleStockType)
          const sansLignes = avoir.lignes.length === 0
          if (sansLignes || libres.some(l => l.montantTTC !== 0)) {
            if (facture.lignes.length > 0 && facture.lignes.every(duLot)) montant += sansLignes ? avoir.totalTTC : libres.reduce((s, l) => s + l.montantTTC, 0)
            else if (avoir.totalTTC !== 0) groupe.vente.revenuTTC = null
          }
          groupe.vente.montantAvoirs += montant
          if (groupe.vente.revenuTTC != null) groupe.vente.revenuTTC -= montant
        }
      }
      groupes.set(cle, groupe)
    }
    const v = groupe.vente
    v.quantiteLivree += m.quantite
    if (m.retour?.userId === userId) v.quantiteRetournee += Math.abs(m.retour.quantite)
    const ligne = m.ligneDocument ?? m.ligneFacture
    if (ligne && ligne.quantite > 0) v.montantLivre += ligne.montantTTC * m.quantite / ligne.quantite
    if (document && !v.documents.some(d => d.id === document.id)) v.documents.push({ id: document.id, numero: document.numero })
  }
  for (const { lotId, vente } of groupes.values()) {
    vente.quantiteNette = Math.max(0, vente.quantiteLivree - vente.quantiteRetournee)
    vente.montantLivre = arrondir(vente.montantLivre)
    vente.montantAvoirs = arrondir(vente.montantAvoirs)
    if (vente.revenuTTC != null) vente.revenuTTC = arrondir(vente.revenuTTC)
    const lots = resultat.get(lotId) ?? []
    lots.push(vente)
    resultat.set(lotId, lots)
  }
  return resultat
}
