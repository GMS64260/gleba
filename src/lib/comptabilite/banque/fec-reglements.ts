import prisma from '@/lib/prisma'
import type { CompteBancaire } from '@prisma/client'
import { auxiliaireClient, type FecInputReglement, type FecInputMouvementInterne } from '../fec'
import { entierCentimes } from '../monnaie'
export function tresorerieCompte(c: Pick<CompteBancaire, 'connexionStripeId' | 'nom'>) {
  return {
    num: c.connexionStripeId ? '511500' : '512000',
    lib: c.connexionStripeId ? 'Encaissements Stripe · ' + c.nom : 'Banque · ' + c.nom,
  }
}
export async function chargerFecReglements(userId: string, debut: Date, fin: Date) {
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
      tiers: f ? { num: auxiliaireClient(f.clientId, f.clientNom), lib: f.clientNom } : undefined,
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
  const mouvements = new Map<string, FecInputMouvementInterne>()
  const ajouter = (o: (typeof payouts)[number]) => {
    if (o.date < debut || o.date > fin) return
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
