import type { CompteBancaire, OperationBancaire, Prisma } from '@prisma/client'
import type { z } from 'zod'
import prisma from '@/lib/prisma'
import { invalidateKpi } from '@/lib/kpi'
import { rapprochementSchema } from '@/lib/validations/reglements'
import {
  ajouterReglementTx,
  verifierAllocationBancaire,
  verrouillerReglements,
  reglementDTO,
} from '../reglements'
import { entierCentimes, ErreurReglement } from '../monnaie'
import { lireReleveCsv } from './releve'
import { estFamilleVirement } from './familles-virement'
export function compteDTO(c: CompteBancaire) {
  return {
    id: c.id,
    nom: c.nom,
    devise: c.devise,
    source: c.connexionStripeId ? 'stripe' : 'releve',
    archive: c.archive,
    solde: c.soldeCentimes == null ? null : entierCentimes(c.soldeCentimes) / 100,
    soldeAu: c.soldeAu,
  }
}
export function operationDTO(
  o: OperationBancaire & {
    reglements: Array<{ montantCentimes: bigint; partieBancaire: string }>
    virementsSortants?: Array<{ id: string }>
    virementsEntrants?: Array<{ id: string }>
  },
) {
  const virementRapproche = Boolean(o.virementsSortants?.length || o.virementsEntrants?.length)
  const utilise = (partie: string) =>
    o.reglements
      .filter((r) => r.partieBancaire === partie)
      .reduce((n, r) => n + Math.abs(entierCentimes(r.montantCentimes)), 0)
  return {
    id: o.id,
    compteId: o.compteId,
    date: o.date,
    libelle: o.libelle,
    reference: o.referenceExterne,
    montant: entierCentimes(o.montantCentimes) / 100,
    brut: entierCentimes(o.brutCentimes) / 100,
    frais: entierCentimes(o.fraisCentimes) / 100,
    famille: o.famille,
    statut: o.statut,
    aVerifier: o.aVerifier,
    motifExclusion: o.motifExclusion,
    virementRapproche,
    virementId: o.virementsSortants?.[0]?.id ?? o.virementsEntrants?.[0]?.id ?? null,
    restePrincipal: virementRapproche
      ? 0
      : Math.max(0, Math.abs(entierCentimes(o.brutCentimes)) - utilise('principal')) / 100,
    resteFrais:
      Math.max(0, Math.abs(entierCentimes(o.fraisCentimes)) - utilise('frais')) / 100,
  }
}
export async function importerReleve(userId: string, compteId: string, texte: string) {
  const lignes = lireReleveCsv(texte)
  return prisma.$transaction(
    async (db) => {
      await verrouillerReglements(db, userId)
      const compte = await db.compteBancaire.findFirst({
        where: { id: compteId, userId, archive: false },
      })
      if (!compte || compte.connexionStripeId)
        throw new ErreurReglement('Choisissez un compte de relevés actif.', 400)
      const existantes = await db.operationBancaire.findMany({
        where: { compteId, userId, referenceExterne: { in: lignes.map((l) => l.reference) } },
      })
      const parRef = new Map(existantes.map((o) => [o.referenceExterne, o]))
      const nouvelles: Prisma.OperationBancaireCreateManyInput[] = []
      for (const l of lignes) {
        const ancienne = parRef.get(l.reference)
        if (ancienne) {
          if (
            ancienne.montantCentimes !== BigInt(l.montantCentimes) ||
            ancienne.libelle !== l.libelle ||
            ancienne.date.getTime() !== l.date.getTime()
          )
            throw new ErreurReglement(
              'Une référence existe avec un autre montant, une autre date ou un autre libellé. Aucun remplacement automatique.',
            )
        } else
          nouvelles.push({
            userId,
            compteId,
            referenceExterne: l.reference,
            date: l.date,
            libelle: l.libelle,
            montantCentimes: BigInt(l.montantCentimes),
            brutCentimes: BigInt(l.montantCentimes),
          })
      }
      const resultat = nouvelles.length
        ? await db.operationBancaire.createMany({ data: nouvelles })
        : { count: 0 }
      return { importees: resultat.count, dejaPresentes: lignes.length - resultat.count }
    },
    { timeout: 30000 },
  )
}
export async function rapprocherOperation(
  userId: string,
  acteurId: string,
  entree: z.infer<typeof rapprochementSchema>,
) {
  const reglement = await prisma.$transaction(async (db) => {
    await verrouillerReglements(db, userId)
    const lien = { operationId: entree.operationId, partie: entree.partie }
    if (entree.reglementId) {
      const r = await db.reglement.findFirst({
        where: { id: entree.reglementId, userId, annuleLe: null },
        include: { dossier: true },
      })
      if (!r) throw new ErreurReglement('Règlement introuvable.', 404)
      if (
        r.operationBancaireId &&
        (r.operationBancaireId !== lien.operationId || r.partieBancaire !== lien.partie)
      )
        throw new ErreurReglement('Ce règlement est déjà rapproché avec une autre opération.')
      await verifierAllocationBancaire(
        db,
        userId,
        lien,
        r.dossier.sens,
        entierCentimes(r.montantCentimes),
        r.dossier.devise,
        r.id,
      )
      return db.reglement.update({
        where: { id: r.id, userId },
        data: { operationBancaireId: lien.operationId, partieBancaire: lien.partie },
      })
    }
    const op = await db.operationBancaire.findFirst({
      where: { id: entree.operationId, userId },
      include: { compte: true },
    })
    if (!op || !entree.cible || entree.montant === undefined || !entree.modeReglement)
      throw new ErreurReglement('Opération, pièce ou montant manquant.', 400)
    return ajouterReglementTx(
      db,
      userId,
      acteurId,
      {
        ...entree.cible,
        montant: entree.montant,
        date: op.date,
        modeReglement: entree.modeReglement,
        reference: op.referenceExterne,
        cleIdempotence: entree.cleIdempotence,
        remboursement: entree.remboursement,
      },
      lien,
    )
  })
  invalidateKpi(userId)
  return reglementDTO(reglement)
}

/** Un virement interne déplace la trésorerie, sans créer recette ni dépense. */
export async function rapprocherVirement(
  userId: string,
  acteurId: string,
  sortieId: string,
  entreeId: string,
) {
  return prisma.$transaction(async (db) => {
    await verrouillerReglements(db, userId)
    if (sortieId === entreeId)
      throw new ErreurReglement('Choisissez deux opérations distinctes.', 400)
    const deja = await db.virementBancaire.findFirst({
      where: {
        userId,
        OR: [{ operationSortieId: sortieId }, { operationEntreeId: entreeId }],
      },
    })
    if (deja) {
      if (deja.operationSortieId === sortieId && deja.operationEntreeId === entreeId)
        return { id: deja.id }
      throw new ErreurReglement('Une de ces opérations est déjà liée à un autre virement.')
    }
    const operations = await db.operationBancaire.findMany({
      where: { userId, id: { in: [sortieId, entreeId] } },
      include: {
        compte: { include: { connexionStripe: { select: { modeTest: true } } } },
        reglements: { where: { userId, annuleLe: null, partieBancaire: 'principal' } },
      },
    })
    const sortie = operations.find((o) => o.id === sortieId),
      entree = operations.find((o) => o.id === entreeId)
    if (!sortie || !entree) throw new ErreurReglement('Virement introuvable.', 404)
    if (
      sortie.compteId === entree.compteId ||
      sortie.compte.devise !== entree.compte.devise ||
      sortie.brutCentimes >= BigInt(0) ||
      entree.brutCentimes <= BigInt(0) ||
      sortie.brutCentimes !== -entree.brutCentimes
    )
      throw new ErreurReglement(
        'Le débit et le crédit doivent avoir le même montant, la même devise et deux comptes différents.',
      )
    if (
      [sortie, entree].some(
        (o) =>
          o.aVerifier ||
          !['comptabilisee', 'ignoree'].includes(o.statut) ||
          o.reglements.length ||
          o.compte.connexionStripe?.modeTest,
      )
    )
      throw new ErreurReglement(
        'Ces opérations ne sont pas disponibles pour un virement réel.',
      )
    const v = await db.virementBancaire.create({
      data: { userId, acteurId, operationSortieId: sortie.id, operationEntreeId: entree.id },
    })
    await db.operationBancaire.updateMany({
      where: { userId, id: { in: [sortie.id, entree.id] } },
      data: { statut: 'comptabilisee', motifExclusion: null },
    })
    return { id: v.id }
  })
}

/** Défaire une association conserve les deux mouvements et tous les versements. */
export async function defaireVirement(userId: string, virementId: string) {
  return prisma.$transaction(async (db) => {
    await verrouillerReglements(db, userId)
    const virement = await db.virementBancaire.findFirst({ where: { id: virementId, userId } })
    if (!virement)
      throw new ErreurReglement(
        'Ce rapprochement a déjà changé. Actualisez les mouvements.',
        404,
      )
    await db.virementBancaire.delete({ where: { id: virement.id, userId } })
    return {
      operationSortieId: virement.operationSortieId,
      operationEntreeId: virement.operationEntreeId,
    }
  })
}

/** Accepter les données révisées seulement si les liens existants restent cohérents. */
export async function validerOperationRevisee(userId: string, operationId: string) {
  await prisma.$transaction(async (db) => {
    await verrouillerReglements(db, userId)
    const op = await db.operationBancaire.findFirst({
      where: { id: operationId, userId },
      include: {
        compte: true,
        reglements: {
          where: { userId, annuleLe: null },
          include: { dossier: { select: { sens: true, devise: true } } },
        },
      },
    })
    if (!op) throw new ErreurReglement('Opération introuvable.', 404)
    if (!op.aVerifier) return
    if (op.reglements.length && op.statut !== 'comptabilisee') {
      throw new ErreurReglement(
        'Ce mouvement est en attente ou exclu. Conservez-le à vérifier tant que des règlements y sont affectés.',
      )
    }
    if (
      estFamilleVirement(op.famille) &&
      op.reglements.some((r) => r.partieBancaire === 'principal')
    ) {
      throw new ErreurReglement(
        'Ce mouvement est devenu un virement entre comptes. Corrigez d’abord les règlements commerciaux qui lui sont affectés ; les frais peuvent rester liés.',
      )
    }
    for (const partie of ['principal', 'frais']) {
      const budget = entierCentimes(partie === 'frais' ? -op.fraisCentimes : op.brutCentimes)
      const lignes = op.reglements.filter((r) => r.partieBancaire === partie)
      const total = lignes.reduce((n, r) => n + Math.abs(entierCentimes(r.montantCentimes)), 0)
      if (
        total > Math.abs(budget) ||
        lignes.some(
          (r) =>
            r.dossier.devise !== op.compte.devise ||
            Math.sign(
              (r.dossier.sens === 'encaissement' ? 1 : -1) * entierCentimes(r.montantCentimes),
            ) !== Math.sign(budget),
        )
      ) {
        throw new ErreurReglement(
          'Les règlements ne correspondent plus au mouvement révisé. Corrigez d’abord leur journal, puis vérifiez à nouveau ce mouvement.',
        )
      }
    }
    const virement = await db.virementBancaire.findFirst({
      where: { userId, OR: [{ operationSortieId: op.id }, { operationEntreeId: op.id }] },
      include: {
        operationSortie: { include: { compte: true } },
        operationEntree: { include: { compte: true } },
      },
    })
    if (virement) {
      const { operationSortie: sortie, operationEntree: entree } = virement
      if (
        sortie.brutCentimes >= BigInt(0) ||
        entree.brutCentimes <= BigInt(0) ||
        sortie.brutCentimes !== -entree.brutCentimes ||
        sortie.compte.devise !== entree.compte.devise
      )
        throw new ErreurReglement(
          'Défaites d’abord le rapprochement de ce virement : ses deux montants ne correspondent plus.',
        )
    }
    await db.operationBancaire.update({
      where: { id: op.id, userId },
      data: { aVerifier: false },
    })
  })
}
