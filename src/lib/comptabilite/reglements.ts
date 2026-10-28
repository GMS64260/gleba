import type { Prisma, Reglement } from '@prisma/client'
import prisma from '@/lib/prisma'
import type { z } from 'zod'
import type { CibleDeReglement, nouveauReglementSchema } from '@/lib/validations/reglements'
import { invalidateKpi } from '@/lib/kpi'
import { finJourLivraison } from '@/lib/commercial/dates-stock'
import {
  resoudreCibleReglement,
  montantRegleDossier,
  projeterEtatReglement,
  type DbReglement,
  type CibleResolue,
} from './cibles-reglement'
import { entierCentimes, ErreurReglement, lireMontant, soldeReglement } from './monnaie'

type EntreeReglement = z.infer<typeof nouveauReglementSchema>
export type LienBancaire = { operationId: string; partie: 'principal' | 'frais' }
import { verrouillerReglements } from './verrou-reglements'
export { verrouillerReglements } from './verrou-reglements'

function metadataDossier(cible: CibleResolue) {
  return {
    sens: cible.sens,
    devise: cible.devise,
    libelle: cible.libelle,
    tiers: cible.tiers,
    referencePiece: cible.piece,
    datePiece: cible.date,
    montantReferenceCentimes: BigInt(cible.total),
  }
}
export async function chercherDossier(db: DbReglement, userId: string, cible: CibleResolue) {
  return db.dossierReglement.findFirst({
    where: { userId, cibles: { some: { userId, cle: { in: cible.cles } } } },
  })
}
export async function assurerDossier(db: DbReglement, userId: string, cible: CibleResolue) {
  const existant = await chercherDossier(db, userId, cible)
  if (existant) {
    if (existant.devise !== cible.devise || existant.sens !== cible.sens)
      throw new ErreurReglement(
        'La devise ou le sens de cette pièce a changé. Régularisez son journal de règlements.',
      )
    return db.dossierReglement.update({
      where: { id: existant.id, userId },
      data: metadataDossier(cible),
    })
  }
  return db.dossierReglement.create({
    data: {
      userId,
      historiqueDeclarePaye: cible.historiquePaye,
      ...metadataDossier(cible),
      cibles: { create: { cle: cible.cle, type: cible.type, reference: String(cible.id) } },
    },
  })
}
export function reglementDTO(r: Reglement) {
  return {
    id: r.id,
    dossierId: r.dossierId,
    montant: entierCentimes(r.montantCentimes) / 100,
    date: r.date,
    modeReglement: r.modeReglement,
    reference: r.reference,
    notes: r.notes,
    operationBancaireId: r.operationBancaireId,
    partieBancaire: r.partieBancaire,
    annuleLe: r.annuleLe,
    motifAnnulation: r.motifAnnulation,
  }
}
export async function lireReglements(
  userId: string,
  demande: CibleDeReglement,
  db: DbReglement = prisma,
) {
  const cible = await resoudreCibleReglement(db, userId, demande)
  const dossier = await chercherDossier(db, userId, cible)
  const reglements = dossier
    ? await db.reglement.findMany({
        where: { userId, dossierId: dossier.id },
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
      })
    : []
  const regle = reglements
    .filter((r) => !r.annuleLe)
    .reduce((n, r) => entierCentimes(n + entierCentimes(r.montantCentimes)), 0)
  return {
    cible: { type: cible.type, id: cible.id },
    dossierId: dossier?.id ?? null,
    devise: dossier?.devise ?? cible.devise,
    libelle: cible.libelle,
    montantPieceAvantAvoirs: cible.brut / 100,
    historiqueDeclarePaye: dossier?.historiqueDeclarePaye ?? cible.historiquePaye,
    historiquePaye: cible.historiquePaye,
    ...soldeReglement(cible.total, regle, cible.historiquePaye, Boolean(dossier)),
    reglements: reglements.map(reglementDTO),
  }
}

export async function verifierAllocationBancaire(
  db: DbReglement,
  userId: string,
  lien: LienBancaire,
  sens: string,
  montant: number,
  devise: string,
  reglementId?: string,
) {
  await db.$queryRaw`SELECT id FROM operations_bancaires WHERE id = ${lien.operationId} AND user_id = ${userId} FOR UPDATE`
  const op = await db.operationBancaire.findFirst({
    where: { id: lien.operationId, userId },
    include: {
      compte: { include: { connexionStripe: { select: { modeTest: true, actif: true } } } },
      reglements: {
        where: { userId, annuleLe: null },
        select: { id: true, montantCentimes: true, partieBancaire: true },
      },
    },
  })
  if (!op) throw new ErreurReglement('Opération bancaire introuvable.', 404)
  if (op.compte.connexionStripe?.modeTest)
    throw new ErreurReglement(
      'Les opérations Stripe de test ne peuvent pas régler des pièces réelles.',
    )
  if (op.compte.connexionStripe && !op.compte.connexionStripe.actif)
    throw new ErreurReglement('Cette connexion Stripe est désactivée.')
  if (
    lien.partie === 'principal' &&
    ['payout', 'payout_cancel', 'payout_failure', 'transfer', 'transfer_cancel'].includes(
      op.famille,
    )
  )
    throw new ErreurReglement(
      'Ce mouvement est un virement entre comptes, pas une recette ou une charge. Rapprochez-le avec le mouvement correspondant de votre banque.',
    )
  if (
    lien.partie === 'principal' &&
    (await db.virementBancaire.count({
      where: { userId, OR: [{ operationSortieId: op.id }, { operationEntreeId: op.id }] },
    }))
  )
    throw new ErreurReglement('Ce mouvement est déjà rapproché comme virement entre comptes.')
  if (op.statut !== 'comptabilisee' || op.aVerifier)
    throw new ErreurReglement('Cette opération est en attente, exclue ou à vérifier.')
  if (op.compte.devise !== devise)
    throw new ErreurReglement('Les devises de la pièce et du compte doivent correspondre.')
  const budgetSigne = entierCentimes(lien.partie === 'frais' ? -op.fraisCentimes : op.brutCentimes)
  const flux = sens === 'encaissement' ? montant : -montant
  if (!budgetSigne || Math.sign(flux) !== Math.sign(budgetSigne))
    throw new ErreurReglement('Le sens du règlement ne correspond pas à cette opération bancaire.')
  const utilise = op.reglements
    .filter((r) => r.id !== reglementId && r.partieBancaire === lien.partie)
    .reduce((n, r) => n + Math.abs(entierCentimes(r.montantCentimes)), 0)
  if (utilise + Math.abs(montant) > Math.abs(budgetSigne))
    throw new ErreurReglement('Le montant dépasse le solde à rapprocher de cette opération.')
  return op
}

/** Appelé dans la transaction de rapprochement ou depuis le formulaire manuel. */
export async function ajouterReglementTx(
  db: DbReglement,
  userId: string,
  acteurId: string,
  entree: EntreeReglement,
  lien?: LienBancaire,
) {
  const montantSaisi = lireMontant(entree.montant)
  if (montantSaisi <= 0) throw new ErreurReglement('Le montant doit être strictement positif.', 400)
  if (!Number.isFinite(entree.date.getTime()) || entree.date > finJourLivraison(new Date()))
    throw new ErreurReglement('Un encaissement ne peut pas être daté dans le futur.', 400)
  const montant = entree.remboursement ? -montantSaisi : montantSaisi
  const cible = await resoudreCibleReglement(db, userId, entree, true)
  const dossier = await assurerDossier(db, userId, cible)
  const precedent = await db.reglement.findUnique({
    where: { userId_cleIdempotence: { userId, cleIdempotence: entree.cleIdempotence } },
  })
  if (precedent) {
    if (
      precedent.dossierId !== dossier.id ||
      entierCentimes(precedent.montantCentimes) !== montant ||
      precedent.modeReglement !== entree.modeReglement ||
      precedent.date.getTime() !== entree.date.getTime() ||
      precedent.operationBancaireId !== (lien?.operationId ?? null) ||
      precedent.partieBancaire !== (lien?.partie ?? 'principal') ||
      precedent.reference !== (entree.reference || null) ||
      precedent.notes !== (entree.notes || null)
    )
      throw new ErreurReglement('Cette clé a déjà été utilisée pour un autre règlement.')
    return precedent
  }
  const dejaRegle = await montantRegleDossier(db, userId, dossier.id)
  const plafond =
    entree.regularisationHistorique && dossier.historiqueDeclarePaye ? cible.brut : cible.total
  if (montant > 0 && dejaRegle + montant > plafond)
    throw new ErreurReglement('Le règlement dépasse le reste à payer. Actualisez la pièce.')
  if (montant < 0 && dejaRegle + montant < 0)
    throw new ErreurReglement('Le remboursement dépasse les règlements enregistrés.')
  if (lien) await verifierAllocationBancaire(db, userId, lien, cible.sens, montant, cible.devise)
  const cree = await db.reglement.create({
    data: {
      userId,
      dossierId: dossier.id,
      montantCentimes: BigInt(montant),
      date: entree.date,
      modeReglement: entree.modeReglement,
      reference: entree.reference || null,
      notes: entree.notes || null,
      acteurId,
      cleIdempotence: entree.cleIdempotence,
      operationBancaireId: lien?.operationId,
      partieBancaire: lien?.partie ?? 'principal',
    },
  })
  await projeterEtatReglement(
    db,
    userId,
    cible,
    dejaRegle + montant,
    entree.modeReglement,
    entree.date,
  )
  return cree
}
export async function enregistrerReglement(
  userId: string,
  acteurId: string,
  entree: EntreeReglement,
) {
  const r = await prisma.$transaction(async (db) => {
    await verrouillerReglements(db, userId)
    return ajouterReglementTx(db, userId, acteurId, entree)
  })
  invalidateKpi(userId)
  return reglementDTO(r)
}

export async function annulerReglement(
  userId: string,
  acteurId: string,
  id: string,
  motif: string,
) {
  await prisma.$transaction(async (db) => {
    await verrouillerReglements(db, userId)
    const r = await db.reglement.findFirst({
      where: { id, userId },
      include: { dossier: { include: { cibles: true } } },
    })
    if (!r) throw new ErreurReglement('Règlement introuvable.', 404)
    if (r.annuleLe) return
    const candidats = r.dossier.cibles.sort(
      (a, b) => Number(b.type === 'Facture') - Number(a.type === 'Facture'),
    )
    let cible: CibleResolue | undefined
    for (const c of candidats) {
      try {
        let idSource = Number(c.reference)
        // Les miroirs automatiques sont régénérés : leur PK change, leur clé
        // métier reste stable. Retrouver la pièce actuelle pour la correction.
        if (['VenteManuelle', 'DepenseManuelle'].includes(c.type) && c.cle.startsWith('[')) {
          const [nature, sourceType, mode, reference] = JSON.parse(c.cle) as string[]
          const where = {
            userId,
            auto: true,
            sourceType,
            ...(mode === 'ref' ? { sourceRef: reference } : { sourceId: Number(reference) }),
          }
          const miroir =
            nature === 'vente'
              ? await db.venteManuelle.findFirst({ where, select: { id: true } })
              : await db.depenseManuelle.findFirst({ where, select: { id: true } })
          if (miroir) idSource = miroir.id
        }
        cible = await resoudreCibleReglement(
          db,
          userId,
          { type: c.type as CibleDeReglement['type'], id: idSource },
          true,
        )
        break
      } catch (e) {
        if (!(e instanceof ErreurReglement) || e.status !== 404) throw e
      }
    }
    if (!cible)
      throw new ErreurReglement('La pièce d’origine doit être régularisée avant son règlement.')
    const apres =
      (await montantRegleDossier(db, userId, r.dossierId)) - entierCentimes(r.montantCentimes)
    if (apres < 0)
      throw new ErreurReglement('Annulez d’abord le remboursement associé à ce règlement.')
    await db.reglement.update({
      where: { id, userId },
      data: { annuleLe: new Date(), annulePar: acteurId, motifAnnulation: motif },
    })
    await projeterEtatReglement(db, userId, cible, apres)
  })
  invalidateKpi(userId)
}

export { chargerSoldesReglements } from './lecture-reglements'
export type ReglementTx = Prisma.TransactionClient
