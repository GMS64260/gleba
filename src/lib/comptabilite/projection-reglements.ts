import { chargerSoldesReglements } from './lecture-reglements'
import {
  cleFacture,
  cleMiroirReglement,
  cleSourceReglement,
  type IdentiteMiroir,
} from './cle-reglement'
import { enCentimes } from './monnaie'
import prisma from '@/lib/prisma'
import { chargerMontantsNetsCaisse } from '@/lib/caisse/creances'
import type { DbReglement } from './cibles-reglement'

async function chargerProjectionMiroirs(
  userId: string,
  nature: 'vente' | 'depense',
  lignes: readonly (IdentiteMiroir & { montant: number })[],
  cles: string[],
  borne?: Date,
) {
  const lire = async (db: DbReglement) => {
    const [suivis, nets] = await Promise.all([
      chargerSoldesReglements(userId, cles, db, borne),
      nature === 'vente'
        ? chargerMontantsNetsCaisse(db, userId, lignes, borne)
        : Promise.resolve(new Map<string, number>()),
    ])
    return { suivis, nets }
  }
  // Les avoirs et le journal de règlements doivent voir le même remboursement validé.
  if (nature === 'vente' && lignes.some((l) => l.sourceType === 'caisse' && l.sourceRef)) {
    return prisma.$transaction(lire, { isolationLevel: 'RepeatableRead' })
  }
  return lire(prisma)
}
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
  const {suivis,nets}=await chargerProjectionMiroirs(userId,nature,lignes,lignes.map(l=>cleMiroirReglement(nature,l)),borne)
  return lignes.map((l) => {
    const s = suivis.get(cleMiroirReglement(nature, l))
    const correction=nature==='vente'&&l.sourceType==='caisse_avoir'
    const original=nature==='vente'&&l.sourceType==='caisse'&&!!l.sourceRef
    const reference=original?nets.get(l.sourceRef!)??enCentimes(l.montant):enCentimes(l.montant)
    return {
      ...l,
      ...(correction?{reglementsDisponibles:false}:{}),
      montantRegle: !correction&&s ? s.regleCentimes / 100 : null,
      resteAPayer: correction?0:(s||original)?Math.max(0,reference-(s?.regleCentimes??0))/100:null,
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
    reglementsDisponibles?: boolean
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
  const presents=lignes.flatMap(l=>{
    const m=(l.source==='VenteManuelle'||l.source==='DepenseManuelle')?parId.get(l.sourceId):null
    return m?[{...m,montant:l.montant}]:[]
  })
  const {suivis,nets}=await chargerProjectionMiroirs(userId,nature,presents,lignes
      .filter((l) => l.comptable !== false)
      .map(cle)
      .filter(Boolean))
  return lignes.map((l) => {
    const s = suivis.get(cle(l))
    const m=l.source==='VenteManuelle'?parId.get(l.sourceId):null
    const correction=nature==='vente'&&m?.sourceType==='caisse_avoir'
    const original=nature==='vente'&&m?.sourceType==='caisse'&&!!m.sourceRef
    const reference=original?nets.get(m!.sourceRef!)??enCentimes(l.montant):enCentimes(l.montant)
    return {
      ...l,
      reglementsDisponibles: correction?false:l.reglementsDisponibles ?? !(l.source === 'VenteManuelle' && parId.get(l.sourceId)?.sourceType === 'reservation_elevage'),
      montantRegle: !correction&&s ? s.regleCentimes / 100 : null,
      resteAPayer:
        correction?0:(s||original) && !l.facture && !l.factureId
          ? Math.max(0, reference - (s?.regleCentimes??0)) / 100
          : null,
    }
  })
}
