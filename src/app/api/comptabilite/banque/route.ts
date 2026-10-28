import { estCompteDemo } from '@/lib/demo-garde'
import { lireJsonBorne } from '@/lib/comptabilite/requete-bornee'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { requireAuthApi } from '@/lib/auth-utils'
import { compteBancaireSchema, rapprochementSchema } from '@/lib/validations/reglements'
import {
  compteDTO,
  operationDTO,
  importerReleve,
  rapprocherOperation,
  rapprocherVirement,
  defaireVirement,
  validerOperationRevisee,
} from '@/lib/comptabilite/banque/service'
import {
  connecterCleStripe,
  synchroniserStripe,
  configurationStripe,
} from '@/lib/comptabilite/banque/stripe'
import { ErreurReglement } from '@/lib/comptabilite/monnaie'
import { verrouillerReglements } from '@/lib/comptabilite/reglements'
const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('annuler-virement'), virementId: z.string().min(1).max(100) }),
  z.object({ action: z.literal('valider-operation'), operationId: z.string().min(1).max(100) }),
  z.object({
    action: z.literal('virement'),
    sortieId: z.string().min(1).max(100),
    entreeId: z.string().min(1).max(100),
  }),
  compteBancaireSchema.extend({ action: z.literal('compte') }),
  z.object({ action: z.literal('stripe-cle'), cle: z.string().min(20).max(500) }),
  z.object({ action: z.literal('synchroniser'), connexionId: z.string().min(1).max(100) }),
  z.object({ action: z.literal('deconnecter'), connexionId: z.string().min(1).max(100) }),
  z.object({
    action: z.literal('importer'),
    compteId: z.string().min(1).max(100),
    csv: z.string().min(1).max(1_000_000),
  }),
  z.object({ action: z.literal('rapprocher'), rapprochement: rapprochementSchema }),
  z.object({
    action: z.literal('exclure'),
    operationId: z.string().min(1).max(100),
    motif: z.string().trim().min(3).max(500),
  }),
  z.object({ action: z.literal('retablir'), operationId: z.string().min(1).max(100) }),
])
export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const userId = session.user.id,
    compteId = request.nextUrl.searchParams.get('compteId'),
    curseur = request.nextUrl.searchParams.get('curseur')
  const [comptes, connexions, operations, compteDemo] =
    await Promise.all([
      prisma.compteBancaire.findMany({
        where: { userId, archive: false },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.connexionStripe.findMany({
        where: { userId },
        select: {
          id: true,
          actif: true,
          modeTest: true,
          derniereSynchro: true,
          historiqueComplet: true,
          curseurNouveaux: true,
        },
      }),
      prisma.operationBancaire.findMany({
        where: { userId, ...(compteId ? { compteId } : {}) },
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        take: 101,
        ...(curseur ? { cursor: { id: curseur, userId }, skip: 1 } : {}),
        include: {
          virementsSortants: { select: { id: true } },
          virementsEntrants: { select: { id: true } },
          reglements: {
            where: { userId, annuleLe: null },
            select: { montantCentimes: true, partieBancaire: true },
          },
        },
      }),
      estCompteDemo(userId),
    ])
  return NextResponse.json({
    compteDemo,
    comptes: comptes.map(compteDTO),
    connexions: connexions.map((c) => ({
      id: c.id,
      actif: c.actif,
      modeTest: c.modeTest,
      derniereSynchro: c.derniereSynchro,
      resteHistorique: !c.historiqueComplet || Boolean(c.curseurNouveaux),
    })),
    operations: operations.slice(0, 100).map(operationDTO),
    curseurSuivant: operations.length > 100 ? operations[99].id : null,
    configuration: configurationStripe(),
    peutConnecter:
      session.user.estProprietaireExploitation && !session.user.impersonatedBy && !compteDemo,
  })
}
export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  if (session.user.peutEcrireExploitation === false || session.user.impersonatedBy)
    return NextResponse.json({ error: 'Cette session est en lecture seule.' }, { status: 403 })
  try {
    const entree = actionSchema.safeParse(await lireJsonBorne(request, 1_200_000))
    if (!entree.success)
      return NextResponse.json(
        { error: 'Données invalides', details: entree.error.flatten() },
        { status: 400 },
      )
    const d = entree.data,
      userId = session.user.id,
      acteurId = session.user.acteurId ?? userId
    if (
      ['stripe-cle', 'deconnecter'].includes(d.action) &&
      (!session.user.estProprietaireExploitation || session.user.impersonatedBy)
    )
      throw new ErreurReglement('Seul le propriétaire peut gérer une connexion Stripe.', 403)
    if (d.action === 'importer' && (await estCompteDemo(userId)))
      throw new ErreurReglement(
        'Créez votre propre compte pour importer un relevé bancaire ; la démonstration est partagée.',
        403,
      )
    if (d.action === 'annuler-virement') return NextResponse.json({ data: await defaireVirement(userId, d.virementId) })
    if (d.action === 'valider-operation') { await validerOperationRevisee(userId, d.operationId); return NextResponse.json({ success: true }) }
    if (d.action === 'virement')
      return NextResponse.json({
        data: await rapprocherVirement(userId, acteurId, d.sortieId, d.entreeId),
      })
    if (d.action === 'compte')
      return NextResponse.json(
        {
          data: compteDTO(
            await prisma.compteBancaire.create({ data: { userId, nom: d.nom, devise: d.devise } }),
          ),
        },
        { status: 201 },
      )
    if (d.action === 'stripe-cle')
      return NextResponse.json({ data: await connecterCleStripe(userId, d.cle) })
    if (d.action === 'synchroniser')
      return NextResponse.json(await synchroniserStripe(userId, d.connexionId))
    if (d.action === 'deconnecter') {
      const resultat = await prisma.connexionStripe.updateMany({
        where: {
          id: d.connexionId,
          userId,
          OR: [{ verrouSynchroJusqua: null }, { verrouSynchroJusqua: { lt: new Date() } }],
        },
        data: { actif: false, jetonChiffre: '' },
      })
      if (!resultat.count)
        throw new ErreurReglement(
          'Connexion introuvable ou synchronisation en cours. Réessayez après sa fin.',
        )
      return NextResponse.json({ success: true })
    }
    if (d.action === 'importer')
      return NextResponse.json(await importerReleve(userId, d.compteId, d.csv))
    if (d.action === 'rapprocher')
      return NextResponse.json({
        data: await rapprocherOperation(userId, acteurId, d.rapprochement),
      })
    if (d.action === 'exclure' || d.action === 'retablir') {
      await prisma.$transaction(async (db) => {
        await verrouillerReglements(db, userId)
        const op = await db.operationBancaire.findFirst({
          where: { id: d.operationId, userId },
          include: { reglements: { where: { userId, annuleLe: null } } },
        })
        if (!op) throw new ErreurReglement('Opération introuvable.', 404)
        if (d.action === 'exclure' && op.statut !== 'comptabilisee')
          throw new ErreurReglement('Seule une opération comptabilisée peut être exclue.')
        if (
          await db.virementBancaire.count({
            where: { userId, OR: [{ operationSortieId: op.id }, { operationEntreeId: op.id }] },
          })
        )
          throw new ErreurReglement('Ce mouvement appartient à un virement entre comptes.')
        if (op.reglements.length)
          throw new ErreurReglement('Une opération rapprochée ne peut pas être exclue.')
        if (d.action === 'retablir' && op.statut !== 'ignoree')
          throw new ErreurReglement('Cette opération n’est pas exclue.')
        await db.operationBancaire.update({
          where: { id: op.id, userId },
          data: {
            statut: d.action === 'exclure' ? 'ignoree' : 'comptabilisee',
            motifExclusion: d.action === 'exclure' ? d.motif : null,
          },
        })
      })
      return NextResponse.json({ success: true })
    }
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof ErreurReglement
            ? e.message
            : 'L’opération bancaire n’a pas pu être terminée.',
      },
      { status: e instanceof ErreurReglement ? e.status : 500 },
    )
  }
}
