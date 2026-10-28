import { estFamilleVirement } from './familles-virement'
import prisma from '@/lib/prisma'
import type { CompteBancaire } from '@prisma/client'
import {
  auxiliaireClient,
  type FecInputReglement,
  type FecInputMouvementInterne,
} from '../fec'
import { entierCentimes, ErreurReglement } from '../monnaie'
import { deviseDuTerritoire } from '@/lib/territoires'
export function tresorerieCompte(c: Pick<CompteBancaire, 'connexionStripeId' | 'nom'>) {
  return {
    num: c.connexionStripeId ? '511500' : '512000',
    lib: c.connexionStripeId ? 'Encaissements Stripe · ' + c.nom : 'Banque · ' + c.nom,
  }
}
export function verifierDeviseFec(devise: string, attendue: string) {
  if (devise !== attendue)
    throw new ErreurReglement(
      `Le FEC en ${attendue} contient des mouvements en ${devise} qui nécessitent une conversion. Consultez ces mouvements dans Comptabilité → Banque ; aucun taux de change implicite n’est appliqué.`,
    )
}
export async function chargerFecReglements(userId: string, debut: Date, fin: Date) {
  const exploitation = await prisma.exploitation.findUnique({
    where: { userId },
    select: { devise: true, territoire: true },
  })
  const deviseComptable = exploitation?.devise || deviseDuTerritoire(exploitation?.territoire)
  const verifierOperation = (op: { aVerifier: boolean; compte: { devise: string } }) => {
    verifierDeviseFec(op.compte.devise, deviseComptable)
    if (op.aVerifier)
      throw new ErreurReglement(
        'Une opération bancaire modifiée doit être vérifiée dans Comptabilité → Banque avant cet export FEC.',
      )
  }
  const reglements = await prisma.reglement.findMany({
    where: {
      userId,
      OR: [{ date: { gte: debut, lte: fin } }, { annuleLe: { gte: debut, lte: fin } }],
    },
    include: {
      dossier: { include: { cibles: { where: { userId, type: 'Facture' } } } },
      operationBancaire: { include: { compte: true } },
    },
  })
  const idsFactures = [
    ...new Set(
      reglements
        .flatMap((r) => r.dossier.cibles.map((c) => Number(c.reference)))
        .filter((id) => Number.isSafeInteger(id) && id > 0),
    ),
  ]
  const factures = idsFactures.length
    ? await prisma.facture.findMany({
        where: { userId, id: { in: idsFactures } },
        select: { id: true, clientId: true, clientNom: true },
      })
    : []
  const parFacture = new Map(factures.map((f) => [f.id, f]))
  const reglementsIn: FecInputReglement[] = reglements.map((r) => {
    verifierDeviseFec(r.dossier.devise, deviseComptable)
    if (r.operationBancaire) verifierOperation(r.operationBancaire)
    if (r.operationBancaire && (!r.annuleLe || r.annuleLe > fin)) {
      if (r.operationBancaire.statut !== 'comptabilisee')
        throw new ErreurReglement(
          'Un règlement est rapproché d’un mouvement en attente ou exclu. Corrigez ce rapprochement avant l’export FEC.',
        )
      if (r.partieBancaire === 'principal' && estFamilleVirement(r.operationBancaire.famille))
        throw new ErreurReglement(
          'Un virement entre comptes porte encore un règlement commercial. Corrigez ce rapprochement avant l’export FEC.',
        )
    }
    const f = parFacture.get(Number(r.dossier.cibles[0]?.reference))
    return {
      id: r.id,
      date: r.date,
      montant: entierCentimes(r.montantCentimes) / 100,
      sens: r.dossier.sens,
      modeReglement: r.modeReglement,
      piece: r.reference || r.dossier.referencePiece,
      libelle: r.dossier.libelle,
      annuleLe: r.annuleLe,
      tiers: f
        ? { num: auxiliaireClient(f.clientId, f.clientNom), lib: f.clientNom }
        : undefined,
      compteTresorerie: r.operationBancaire
        ? tresorerieCompte(r.operationBancaire.compte)
        : undefined,
    }
  })
  const [payouts, virements] = await Promise.all([
    prisma.operationBancaire.findMany({
      where: {
        userId,
        date: { gte: debut, lte: fin },
        famille: { in: ['payout', 'payout_cancel', 'payout_failure'] },
        statut: { not: 'en_attente' },
        compte: { connexionStripe: { modeTest: false } },
      },
      include: { compte: true },
    }),
    prisma.virementBancaire.findMany({
      where: {
        userId,
        OR: [
          { operationSortie: { date: { gte: debut, lte: fin } } },
          { operationEntree: { date: { gte: debut, lte: fin } } },
        ],
      },
      include: {
        operationSortie: { include: { compte: true } },
        operationEntree: { include: { compte: true } },
      },
    }),
  ])
  // Rechercher les liaisons actives à la clôture, même annulées depuis : elles pourraient
  // sinon compter le même flux une fois à sa saisie, puis une fois au virement.
  const idsInternes = [
    ...new Set([
      ...payouts.map((o) => o.id),
      ...virements.flatMap((v) => [v.operationSortieId, v.operationEntreeId]),
    ]),
  ]
  if (
    idsInternes.length &&
    (await prisma.reglement.count({
      where: {
        userId,
        date: { lte: fin },
        OR: [{ annuleLe: null }, { annuleLe: { gt: fin } }],
        partieBancaire: 'principal',
        operationBancaireId: { in: idsInternes },
      },
    }))
  ) {
    throw new ErreurReglement(
      'Un virement entre comptes porte encore un règlement commercial. Corrigez ce rapprochement avant l’export FEC.',
    )
  }
  const mouvements = new Map<string, FecInputMouvementInterne>()
  const ajouter = (o: (typeof payouts)[number]) => {
    if (o.date < debut || o.date > fin) return
    verifierOperation(o)
    const n = entierCentimes(o.brutCentimes)
    mouvements.set(o.id, {
      id: o.id,
      date: o.date,
      montant: Math.abs(n) / 100,
      sens: n < 0 ? 'sortie' : 'entree',
      piece: o.referenceExterne,
      compteTresorerie: tresorerieCompte(o.compte),
    })
  }
  for (const o of payouts) ajouter(o)
  for (const v of virements) {
    ajouter(v.operationSortie)
    ajouter(v.operationEntree)
  }
  return { reglements: reglementsIn, mouvementsInternes: [...mouvements.values()] }
}
