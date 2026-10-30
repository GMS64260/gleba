import { estFamilleVirement, FAMILLES_VIREMENT } from './familles-virement'
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
/**
 * Comptes Stripe dont les encaissements passent eux-mêmes par 511500.
 *
 * Revue du 2026-10-29 : une ferme qui pointe ses ventes « payé / CB » les porte
 * directement en 512 (`contrepartieReglement`). Ses versements Stripe vidaient
 * alors 511500 sans l'avoir rempli (solde négatif) et, une fois rapprochés du
 * relevé, débitaient 512 une seconde fois. Règle retenue, la plus prudente sans
 * lien fournisseur entre un versement et ses encaissements : les versements et
 * virements d'un compte Stripe n'entrent au FEC que si, à la clôture, chacun de
 * ses mouvements commerciaux comptabilisés (hors versements, virements et
 * exclusions) depuis l'origine est entièrement rapproché par des règlements
 * actifs, et qu'il y en a au moins un. Sinon le compte reste hors FEC, comme
 * avant toute connexion : 512 porte déjà les ventes pointées payées. Un
 * mouvement ancien jamais rapproché s'exclut depuis Banque avec son motif.
 */
async function comptesStripeRapproches(userId: string, compteIds: string[], fin: Date) {
  if (!compteIds.length) return new Set<string>()
  const operations = await prisma.operationBancaire.findMany({
    where: {
      userId,
      compteId: { in: compteIds },
      statut: 'comptabilisee',
      date: { lte: fin },
      famille: { notIn: [...FAMILLES_VIREMENT] },
      virementsSortants: { none: {} },
      virementsEntrants: { none: {} },
    },
    select: {
      compteId: true,
      brutCentimes: true,
      reglements: {
        where: {
          userId,
          partieBancaire: 'principal',
          date: { lte: fin },
          OR: [{ annuleLe: null }, { annuleLe: { gt: fin } }],
        },
        select: { montantCentimes: true },
      },
    },
  })
  const encaisses = new Set<string>(),
    incomplets = new Set<string>()
  for (const o of operations) {
    const brut = Math.abs(entierCentimes(o.brutCentimes))
    const alloue = o.reglements.reduce((n, r) => n + Math.abs(entierCentimes(r.montantCentimes)), 0)
    if (alloue < brut) incomplets.add(o.compteId)
    else if (brut > 0) encaisses.add(o.compteId)
  }
  return new Set([...encaisses].filter((id) => !incomplets.has(id)))
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
        // Seuls les mouvements comptabilisés entrent au FEC : ni en attente ni exclus.
        statut: 'comptabilisee',
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
  const rapproches = await comptesStripeRapproches(
    userId,
    [
      ...new Set(
        [...payouts.map((o) => o.compte), ...virements.flatMap((v) => [v.operationSortie.compte, v.operationEntree.compte])]
          .filter((c) => c.connexionStripeId)
          .map((c) => c.id),
      ),
    ],
    fin,
  )
  const admis = (o: (typeof payouts)[number]) =>
    o.statut === 'comptabilisee' && (!o.compte.connexionStripeId || rapproches.has(o.compteId))
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
  for (const o of payouts) if (admis(o)) ajouter(o)
  for (const v of virements) {
    // Les deux côtés ou aucun : un côté seul laisserait 580 ouvert et, côté
    // banque, débiterait 512 d'encaissements qui y sont déjà.
    if (!admis(v.operationSortie) || !admis(v.operationEntree)) continue
    ajouter(v.operationSortie)
    ajouter(v.operationEntree)
  }
  return { reglements: reglementsIn, mouvementsInternes: [...mouvements.values()] }
}
