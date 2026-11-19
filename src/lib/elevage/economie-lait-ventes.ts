import { monnaieFacture } from '@/lib/comptabilite/devise-reglement'
import { ErreurDevisesIncompatibles } from '@/lib/comptabilite/totaux-devise'
import type { Devise } from '@/lib/territoires'
import { poidsMoyenPieceKg, uniteVenteFromage, valoriserStockFromage, type LotCave, type StockLotFromage } from './cave-fromage'

export class ErreurVentilationFromage extends Error {
  readonly status = 422
  constructor() {
    super('Calcul indisponible : une facture ou un avoir ne permet pas de répartir les recettes entre les lots de fromage. Vérifiez le détail des pièces et des ventes atelier.')
  }
}
export type LotVentesFromage = { id: string; typeFromage: string; nbPieces: number; poidsTotalKg: number }
export type VenteAtelierFromage = { id: number; lotFromageId: string; date: Date; annule: boolean; factureId: number | null; quantite: number; unite: string; prixTotal: number; poidsKg: number }
type VenteFacturee = { lotFromageId: string | null; unite: string; quantite: number; prixTotal: number }
export type LigneRecetteFromage = { articleStockType: string | null; articleStockId: string | null; unite: string; quantite: number; montantTTC: number }
export type FactureFromage = { id: number; type: string; statut: string; date: Date; factureOrigineId: number | null; totalTTC: number; emetteurSnapshot: unknown; ventesAtelier?: VenteFacturee[]; lignes: LigneRecetteFromage[] }
export type MouvementVenteFromage = { id: string; lotFromageId: string; date: Date; quantite: number; unite: string; poidsKg: number | null; factureId: number | null; documentId: string | null }
export type VenteNetteFromage = { lotFromageId: string; typeFromage: string; quantite: number; unite: string; prixTotal: number; kgVendus: number | null; poidsVenduEstime: boolean; avertissementValorisation?: string }
export type SourcesVentesFromage = { lots: LotVentesFromage[]; atelier: VenteAtelierFromage[]; factures: FactureFromage[]; mouvements: MouvementVenteFromage[] }
export type PeriodeVentesFromage = { debut: Date; fin: Date }
const active = (f: FactureFromage) => !['brouillon', 'annulee'].includes(f.statut)

/** Recettes à la date de la vente atelier ou de la pièce ; quantités à la date
 * du mouvement physique. BL et facture partagent la même source. Les avoirs
 * corrigent les montants, les retours les quantités : jamais deux déductions.
 * Sans mouvement historique, les lignes facturées servent de quantité témoin.
 * En valorisation indicative, une pièce ambiguë neutralise le prix des seuls
 * lots concernés ; elle ne rend pas les stocks physiques inaccessibles.
 */
export function projeterVentesFromage(sources: SourcesVentesFromage, devise: Devise, periode?: PeriodeVentesFromage, valorisation = false): VenteNetteFromage[] {
  const dansPeriode = (date: Date) => !periode || (date >= periode.debut && date <= periode.fin)
  const lots = new Map(sources.lots.map(l => [l.id, l]))
  const factures = new Map(sources.factures.filter(f => f.type !== 'avoir').map(f => [f.id, f]))
  const groupes = new Map<string, VenteNetteFromage>()
  const indisponibles = new Map<string, string>()
  const sourceFacture = (id: number) => `facture:${id}`
  const cle = (source: string, lotId: string) => `${source}:${lotId}`
  const physiques = new Set<string>()
  for (const v of sources.atelier) if (!v.annule && v.factureId != null) physiques.add(cle(sourceFacture(v.factureId), v.lotFromageId))
  for (const m of sources.mouvements) if (m.factureId != null) physiques.add(cle(sourceFacture(m.factureId), m.lotFromageId))
  const natives = (f: FactureFromage) => f.ventesAtelier ?? sources.atelier.filter(v => v.factureId === f.id)

  function ajouter(source: string, lotId: string, unite: string, quantite: number, montant: number, poidsKg?: number | null) {
    const lot = lots.get(lotId)
    if (!lot) return
    const u = uniteVenteFromage(unite)
    const uniteCanonique = u?.unite === 'kg' ? 'kg' : u?.unite === 'piece' ? 'pièce' : unite
    const key = cle(source, lotId)
    const vente = groupes.get(key) ?? { lotFromageId: lotId, typeFromage: lot.typeFromage, quantite: 0, unite: uniteCanonique, prixTotal: 0, kgVendus: 0, poidsVenduEstime: false }
    vente.prixTotal += montant
    if (quantite !== 0) {
      const moyen = poidsMoyenPieceKg(lot)
      const pese = poidsKg != null && poidsKg !== 0
      const kg = pese ? poidsKg : u?.unite === 'kg' ? quantite * u.facteurKg : u?.unite === 'piece' && moyen != null ? quantite * moyen : null
      if (kg == null) vente.kgVendus = null
      else if (vente.kgVendus != null) vente.kgVendus += kg
      if (!pese && u?.unite === 'piece' && moyen != null) vente.poidsVenduEstime = true
      if (vente.quantite === 0) vente.unite = uniteCanonique
      if (vente.unite === uniteCanonique) vente.quantite += u?.unite === 'kg' ? quantite * u.facteurKg : quantite
      else {
        // Plusieurs unités physiques dans une source : le poids réel (sinon
        // estimé) est la quantité commune. L'unité de facturation ne la change pas.
        vente.unite = 'kg'
        vente.quantite = vente.kgVendus ?? 0
        if (vente.kgVendus == null) indisponibles.set(lotId, 'Valorisation indisponible : le poids des ventes aux unités différentes est inconnu.')
      }
    }
    // Prix facturé dans une unité différente de la livraison : le poids
    // réconcilie la recette avec la quantité, y compris une pesée différente
    // du poids moyen du lot. Ne pas transformer un prix au kg en prix par pièce.
    if (quantite === 0 && montant !== 0 && vente.quantite !== 0 && vente.unite !== uniteCanonique) {
      vente.unite = 'kg'
      vente.quantite = vente.kgVendus ?? 0
      if (vente.kgVendus == null) indisponibles.set(lotId, 'Valorisation indisponible : le poids des ventes aux unités différentes est inconnu.')
    }
    groupes.set(key, vente)
  }

  for (const v of sources.atelier) {
    if (v.annule || !dansPeriode(v.date)) continue
    ajouter(v.factureId == null ? `atelier:${v.id}` : sourceFacture(v.factureId), v.lotFromageId, v.unite, v.quantite, v.factureId == null ? v.prixTotal : 0, v.poidsKg)
  }
  for (const m of sources.mouvements) {
    if (!dansPeriode(m.date)) continue
    ajouter(m.factureId == null ? `bl:${m.documentId}` : sourceFacture(m.factureId), m.lotFromageId, m.unite, m.quantite, 0, m.poidsKg)
  }

  function lignesAffectees(f: FactureFromage): LigneRecetteFromage[] {
    const liees = f.lignes.filter(l => l.articleStockType === 'fromage' && lots.has(l.articleStockId ?? ''))
    const libres = f.lignes.filter(l => !l.articleStockType)
    if (f.type !== 'avoir') {
      // Les frais libres d'une facture commerciale ne sont pas du fromage.
      if (f.lignes.some(l => l.articleStockType)) return liees
      const ventes = natives(f)
      // Ancienne facture d'atelier : les montants natifs identifient chaque lot,
      // y compris dans une facture mixte (fromage, lait cru...). Pas de prorata inventé.
      if (ventes.length && Math.round(ventes.reduce((s, v) => s + v.prixTotal, 0) * 100) === Math.round(f.totalTTC * 100)) {
        return ventes.filter(v => lots.has(v.lotFromageId ?? '')).map(v => ({ articleStockType: 'fromage', articleStockId: v.lotFromageId, unite: v.unite, quantite: v.quantite, montantTTC: v.prixTotal }))
      }
      throw new ErreurVentilationFromage()
    }
    if (f.lignes.length > 0 && libres.every(l => l.montantTTC === 0)) return liees
    const origine = factures.get(f.factureOrigineId ?? -1)
    if (!origine) throw new ErreurVentilationFromage()
    if (origine.lignes.some(l => l.articleStockType) && origine.lignes.some(l => !l.articleStockType && l.montantTTC !== 0)) throw new ErreurVentilationFromage()
    const lignesOrigine = origine.lignes.filter(l => l.articleStockType)
    const ventes = natives(origine)
    const ids = new Set([...lignesOrigine.map(l => l.articleStockType === 'fromage' ? l.articleStockId : null), ...ventes.map(v => v.lotFromageId)])
    if (ids.size !== 1 || !lots.has([...ids][0] ?? '')) throw new ErreurVentilationFromage()
    const lotId = [...ids][0]!
    const unites = new Set([...lignesOrigine.map(l => l.unite), ...ventes.map(v => v.unite)])
    if (unites.size !== 1) throw new ErreurVentilationFromage()
    return [...liees, { articleStockType: 'fromage', articleStockId: lotId, unite: [...unites][0], quantite: 0,
      montantTTC: f.lignes.length ? libres.reduce((s, l) => s + l.montantTTC, 0) : f.totalTTC }]
  }

  for (const f of sources.factures) {
    if (!active(f) || !dansPeriode(f.date)) continue
    const origine = f.type === 'avoir' ? factures.get(f.factureOrigineId ?? -1) : f
    const origineConcernee = f.type !== 'avoir' || !f.lignes.length || f.lignes.some(l => !l.articleStockType && l.montantTTC !== 0)
    const idsConcernes = new Set([...f.lignes, ...(origineConcernee ? origine?.lignes ?? [] : [])].filter(l => l.articleStockType === 'fromage').map(l => l.articleStockId))
    if (origine && origineConcernee) for (const v of natives(origine)) idsConcernes.add(v.lotFromageId)
    const propres = [...idsConcernes].filter((id): id is string => id != null && lots.has(id))
    if (!propres.length) continue
    try {
      const source = sourceFacture(f.type === 'avoir' ? f.factureOrigineId ?? f.id : f.id)
      const signe = f.type === 'avoir' ? -1 : 1
      for (const l of lignesAffectees(f)) {
        if (l.montantTTC !== 0 && monnaieFacture(f.emetteurSnapshot, f.date) !== devise) throw new ErreurDevisesIncompatibles()
        const lotId = l.articleStockId!
        const quantite = physiques.has(cle(source, lotId)) ? 0 : signe * l.quantite
        ajouter(source, lotId, l.unite, quantite, signe * l.montantTTC)
      }
    } catch (err) {
      if (!valorisation || !(err instanceof ErreurVentilationFromage || err instanceof ErreurDevisesIncompatibles)) throw err
      for (const id of propres) indisponibles.set(id, err.message)
    }
  }
  for (const [id, message] of indisponibles) {
    ajouter('indisponible', id, 'kg', 0, 0)
    groupes.get(cle('indisponible', id))!.avertissementValorisation = message
  }
  return [...groupes.values()].map(v => ({ ...v, prixTotal: Math.round(v.prixTotal * 100) / 100,
    kgVendus: v.kgVendus == null ? null : Math.round(v.kgVendus * 1000) / 1000 }))
}

/** Un lot à l'historique ambigu garde son stock, mais aucun prix partiel. */
export function valoriserVentesFromage(lot: LotCave, stock: StockLotFromage, ventes: VenteNetteFromage[]) {
  const avertissement = ventes.find(v => v.avertissementValorisation)?.avertissementValorisation
  return { ...(avertissement ? { valorisation: null, prix: null } : valoriserStockFromage(lot, stock, ventes)), avertissementValorisation: avertissement ?? null }
}
