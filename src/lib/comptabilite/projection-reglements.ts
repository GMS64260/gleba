import { chargerSoldesReglements } from './lecture-reglements'
import {
  cleFacture,
  cleMiroirReglement,
  cleSourceReglement,
  type IdentiteMiroir,
} from './cle-reglement'
import { enCentimes } from './monnaie'
export async function enrichirFacturesReglements<T extends { id: number; totalTTC: number }>(
  userId: string,
  lignes: T[],
  borne?: Date,
) {
  const suivis = await chargerSoldesReglements(
    userId,
    lignes.map((l) => cleFacture(l.id)),
    undefined,
    borne,
  )
  return lignes.map((l) => ({
    ...l,
    montantRegle: suivis.has(cleFacture(l.id))
      ? suivis.get(cleFacture(l.id))!.regleCentimes / 100
      : null,
  }))
}
export async function enrichirMiroirsReglements<T extends IdentiteMiroir & { montant: number }>(
  userId: string,
  nature: 'vente' | 'depense',
  lignes: T[],
  borne?: Date,
) {
  const suivis = await chargerSoldesReglements(
    userId,
    lignes.map((l) => cleMiroirReglement(nature, l)),
    undefined,
    borne,
  )
  return lignes.map((l) => {
    const s = suivis.get(cleMiroirReglement(nature, l))
    return {
      ...l,
      montantRegle: s ? s.regleCentimes / 100 : null,
      resteAPayer: s ? Math.max(0, enCentimes(l.montant) - s.regleCentimes) / 100 : null,
    }
  })
}
export async function enrichirVentesElevageReglements<
  T extends { id: number; prixTotal: number; factureId: number | null },
>(userId: string, lignes: T[], borne?: Date) {
  const cle = (l: T) =>
    l.factureId ? cleFacture(l.factureId) : cleSourceReglement('vente', 'vente_produit', l.id)
  const suivis = await chargerSoldesReglements(userId, lignes.map(cle), undefined, borne)
  return lignes.map((l) => {
    const s = suivis.get(cle(l))
    return {
      ...l,
      montantRegle: s ? s.regleCentimes / 100 : null,
      resteAPayer:
        s && !l.factureId ? Math.max(0, enCentimes(l.prixTotal) - s.regleCentimes) / 100 : null,
    }
  })
}

import { MIROIR_VENTE_PAR_SOURCE, MIROIR_DEPENSE_PAR_SOURCE } from './suivi-ecriture'
export async function enrichirLignesReglements<
  T extends {
    id: string
    source: string
    sourceId: number
    montant: number
    comptable?: boolean
    factureId?: number | null
    facture?: { id: number } | null
  },
>(userId: string, nature: 'vente' | 'depense', lignes: T[], miroirs: IdentiteMiroir[]) {
  const parId = new Map(miroirs.map((m) => [m.id, m]))
  const cle = (l: T) => {
    const factureId = l.facture?.id ?? l.factureId ?? (l.source === 'Facture' ? l.sourceId : null)
    if (factureId) return cleFacture(factureId)
    if (l.source === 'VenteManuelle' || l.source === 'DepenseManuelle') {
      const m = parId.get(l.sourceId)
      return m ? cleMiroirReglement(nature, m) : ''
    }
    const type =
      nature === 'vente' ? MIROIR_VENTE_PAR_SOURCE[l.source] : MIROIR_DEPENSE_PAR_SOURCE[l.source]
    return type ? cleSourceReglement(nature, type, l.sourceId) : ''
  }
  const suivis = await chargerSoldesReglements(
    userId,
    lignes
      .filter((l) => l.comptable !== false)
      .map(cle)
      .filter(Boolean),
  )
  return lignes.map((l) => {
    const s = suivis.get(cle(l))
    return {
      ...l,
      reglementsDisponibles: !(l.source === 'VenteManuelle' && parId.get(l.sourceId)?.sourceType === 'reservation_elevage'),
      montantRegle: s ? s.regleCentimes / 100 : null,
      resteAPayer:
        s && !l.facture && !l.factureId
          ? Math.max(0, enCentimes(l.montant) - s.regleCentimes) / 100
          : null,
    }
  })
}
