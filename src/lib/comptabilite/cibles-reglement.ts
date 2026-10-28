import { deviseFactureReglement } from './devise-reglement'
import { modePaiementDepuisReglement } from '@/lib/validations/reglement'
import { Prisma } from '@prisma/client'
import { deviseDuTerritoire } from '@/lib/territoires'
import type { CibleDeReglement } from '@/lib/validations/reglements'
import { cleFacture, cleMiroirReglement, cleSourceReglement } from './cle-reglement'
import { enCentimes, entierCentimes, ErreurReglement } from './monnaie'
export type DbReglement = Prisma.TransactionClient
export interface CibleResolue {
  type: CibleDeReglement['type']
  id: number
  cle: string
  cles: string[]
  sens: 'encaissement' | 'decaissement'
  total: number
  brut: number
  devise: string
  libelle: string
  tiers: string | null
  piece: string
  date: Date
  historiquePaye: boolean
  miroir?: {
    nature: 'vente' | 'depense'
    where: { userId: string; id?: number; auto?: boolean; sourceType?: string; sourceId?: number }
  }
}

export async function resoudreCibleReglement(
  db: DbReglement,
  userId: string,
  demande: CibleDeReglement,
  verrou = false,
): Promise<CibleResolue> {
  const table = {
    Facture: 'factures',
    VenteProduit: 'ventes_produits',
    VenteManuelle: 'ventes_manuelles',
    DepenseManuelle: 'depenses_manuelles',
  }[demande.type]
  if (verrou)
    await db.$queryRaw(
      Prisma.sql`SELECT id FROM ${Prisma.raw(table)} WHERE id = ${demande.id} AND user_id = ${userId} FOR UPDATE`,
    )
  const exploitation = await db.exploitation.findUnique({
    where: { userId },
    select: { territoire: true },
  })
  const devise = deviseDuTerritoire(exploitation?.territoire)
  if (demande.type === 'Facture') {
    const f = await db.facture.findFirst({ where: { id: demande.id, userId } })
    if (!f) throw new ErreurReglement('Pièce introuvable.', 404)
    if (f.type === 'avoir')
      throw new ErreurReglement(
        'Enregistrez le remboursement sur la facture d’origine pour conserver son suivi.',
      )
    if (!['emise', 'payee'].includes(f.statut))
      throw new ErreurReglement('Seule une facture émise peut être réglée.')
    const avoirs = await db.facture.aggregate({
      where: { userId, factureOrigineId: f.id, type: 'avoir', statut: { in: ['emise', 'payee'] } },
      _sum: { totalTTC: true },
    })
    const brut = enCentimes(f.totalTTC)
    return {
      type: 'Facture',
      id: f.id,
      cle: cleFacture(f.id),
      cles: [cleFacture(f.id)],
      sens: 'encaissement',
      total: Math.max(0, brut - enCentimes(avoirs._sum.totalTTC ?? 0)),
      brut,
      devise: deviseFactureReglement(f.emetteurSnapshot, devise),
      libelle: f.objet || 'Facture ' + f.numero,
      tiers: f.clientNom,
      piece: f.numero,
      date: f.date,
      historiquePaye: f.statut === 'payee',
    }
  }
  if (demande.type === 'VenteProduit') {
    const v = await db.venteProduit.findFirst({ where: { id: demande.id, userId } })
    if (!v) throw new ErreurReglement('Vente introuvable.', 404)
    if (v.annule) throw new ErreurReglement('Cette vente est annulée.')
    if (v.factureId)
      return resoudreCibleReglement(db, userId, { type: 'Facture', id: v.factureId }, verrou)
    const cle = cleSourceReglement('vente', 'vente_produit', v.id)
    return {
      type: 'VenteProduit',
      id: v.id,
      cle,
      cles: [cle],
      sens: 'encaissement',
      total: enCentimes(v.prixTotal),
      brut: enCentimes(v.prixTotal),
      devise,
      libelle: v.description || 'Vente ' + v.type,
      tiers: v.client,
      piece: 'ELEV-' + v.id,
      date: v.date,
      historiquePaye: v.paye,
      miroir: {
        nature: 'vente',
        where: { userId, auto: true, sourceType: 'vente_produit', sourceId: v.id },
      },
    }
  }
  if (demande.type === 'VenteManuelle') {
    const v = await db.venteManuelle.findFirst({ where: { id: demande.id, userId } })
    if (!v) throw new ErreurReglement('Vente introuvable. Actualisez les transactions.', 404)
    if (v.auto && v.sourceType === 'vente_produit' && v.sourceId != null)
      return resoudreCibleReglement(db, userId, { type: 'VenteProduit', id: v.sourceId }, verrou)
    if (v.auto && v.sourceType === 'reservation_elevage')
      throw new ErreurReglement(
        'Les acomptes de réservation se suivent dans Élevage, sur la réservation correspondante.',
      )
    const cle = cleMiroirReglement('vente', v)
    return {
      type: 'VenteManuelle',
      id: v.id,
      cle,
      cles: [cle],
      sens: 'encaissement',
      total: enCentimes(v.montant),
      brut: enCentimes(v.montant),
      devise,
      libelle: v.description,
      tiers: v.clientNom,
      piece: v.numeroPiece || 'V-' + v.id,
      date: v.date,
      historiquePaye: v.paye,
      miroir: { nature: 'vente', where: { userId, id: v.id } },
    }
  }
  const d = await db.depenseManuelle.findFirst({ where: { id: demande.id, userId } })
  if (!d) throw new ErreurReglement('Dépense introuvable. Actualisez les transactions.', 404)
  if (!d.comptable)
    throw new ErreurReglement(
      'Ce coût interne est analytique. Réglez la facture fournisseur correspondante.',
    )
  const cle = cleMiroirReglement('depense', d)
  return {
    type: 'DepenseManuelle',
    id: d.id,
    cle,
    cles: [cle],
    sens: 'decaissement',
    total: enCentimes(d.montant),
    brut: enCentimes(d.montant),
    devise,
    libelle: d.description,
    tiers: d.fournisseurNom,
    piece: d.numeroPiece || 'D-' + d.id,
    date: d.date,
    historiquePaye: d.paye,
    miroir: { nature: 'depense', where: { userId, id: d.id } },
  }
}

export async function montantRegleDossier(db: DbReglement, userId: string, dossierId: string) {
  const somme = await db.reglement.aggregate({
    where: { userId, dossierId, annuleLe: null },
    _sum: { montantCentimes: true },
  })
  return entierCentimes(somme._sum.montantCentimes ?? BigInt(0))
}

export async function projeterEtatReglement(
  db: DbReglement,
  userId: string,
  cible: CibleResolue,
  regle: number,
  dernierMode?: string,
  datePaiement?: Date,
) {
  const paye = regle >= cible.total
  if (cible.type === 'Facture') {
    await db.facture.update({
      where: { id: cible.id, userId },
      data: {
        statut: paye ? 'payee' : 'emise',
        datePaiement: paye ? (datePaiement ?? new Date()) : null,
        ...(dernierMode ? { modePaiement: modePaiementDepuisReglement(dernierMode) } : {}),
      },
    })
    await db.venteProduit.updateMany({ where: { userId, factureId: cible.id }, data: { paye } })
    await db.commandeBoutique.updateMany({
      where: { userId, factureId: cible.id },
      data: { paiementStatut: paye ? 'Confirmé' : 'En attente' },
    })
  } else if (cible.type === 'VenteProduit') {
    await db.venteProduit.updateMany({
      where: { id: cible.id, userId, annule: false, factureId: null },
      data: { paye },
    })
  }
  if (cible.miroir) {
    const data = { paye, ...(dernierMode ? { modeReglement: dernierMode } : {}) }
    if (cible.miroir.nature === 'vente') {
      await db.venteManuelle.updateMany({ where: cible.miroir.where, data })
      if (cible.type === 'VenteManuelle')
        await db.commandeBoutique.updateMany({
          where: { userId, venteManuelleId: cible.id },
          data: { paiementStatut: paye ? 'Confirmé' : 'En attente' },
        })
    } else await db.depenseManuelle.updateMany({ where: cible.miroir.where, data })
  }
}
