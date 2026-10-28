import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { requireAuthApi } from '@/lib/auth-utils'
import { entierCentimes, ErreurReglement } from '@/lib/comptabilite/monnaie'

const rechercheSchema = z.object({
  operationId: z.string().min(1).max(100),
  type: z.enum(['reglements', 'virements']),
  partie: z.enum(['principal', 'frais']).default('principal'),
  q: z.string().trim().max(100).default(''),
  curseur: z.string().min(1).max(100).optional(),
})

/** Recherche paginée dans la devise et le sens du mouvement à rapprocher. */
export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const recherche = rechercheSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!recherche.success)
    return NextResponse.json({ error: 'Recherche invalide.' }, { status: 400 })
  const { operationId, type, partie, q, curseur } = recherche.data,
    userId = session.user.id
  try {
    const op = await prisma.operationBancaire.findFirst({
      where: { id: operationId, userId },
      include: { compte: true, reglements: { where: { userId, annuleLe: null } } },
    })
    if (!op) throw new ErreurReglement('Opération introuvable.', 404)
    const budgetSigne = entierCentimes(
      partie === 'frais' ? -op.fraisCentimes : op.brutCentimes,
    )
    const utilise = op.reglements
      .filter((r) => r.partieBancaire === partie)
      .reduce((n, r) => n + Math.abs(entierCentimes(r.montantCentimes)), 0)
    const budget = Math.max(0, Math.abs(budgetSigne) - utilise)
    const page = {
      take: 51,
      orderBy: [{ date: 'desc' as const }, { id: 'desc' as const }],
      ...(curseur ? { cursor: { id: curseur, userId }, skip: 1 } : {}),
    }
    if (type === 'reglements') {
      if (!budget) return NextResponse.json({ data: [], curseurSuivant: null })
      const positif = { gt: BigInt(0), lte: BigInt(budget) },
        negatif = { lt: BigInt(0), gte: -BigInt(budget) }
      const lignes = await prisma.reglement.findMany({
        where: {
          userId,
          annuleLe: null,
          operationBancaireId: null,
          dossier: { devise: op.compte.devise },
          OR: [
            {
              dossier: { sens: 'encaissement' },
              montantCentimes: budgetSigne > 0 ? positif : negatif,
            },
            {
              dossier: { sens: 'decaissement' },
              montantCentimes: budgetSigne > 0 ? negatif : positif,
            },
          ],
          ...(q
            ? {
                AND: [
                  {
                    OR: [
                      { reference: { contains: q, mode: 'insensitive' as const } },
                      { notes: { contains: q, mode: 'insensitive' as const } },
                      {
                        dossier: {
                          OR: [
                            { libelle: { contains: q, mode: 'insensitive' as const } },
                            { referencePiece: { contains: q, mode: 'insensitive' as const } },
                            { tiers: { contains: q, mode: 'insensitive' as const } },
                          ],
                        },
                      },
                    ],
                  },
                ],
              }
            : {}),
        },
        ...page,
        include: {
          dossier: {
            select: { libelle: true, sens: true, devise: true, referencePiece: true },
          },
        },
      })
      return NextResponse.json(
        {
          data: lignes
            .slice(0, 50)
            .map((r) => ({
              id: r.id,
              montant: entierCentimes(r.montantCentimes) / 100,
              date: r.date,
              libelle: r.dossier.libelle,
              sens: r.dossier.sens,
              devise: r.dossier.devise,
              reference: r.reference,
              piece: r.dossier.referencePiece,
            })),
          curseurSuivant: lignes.length > 50 ? lignes[49].id : null,
        },
        { headers: { 'Cache-Control': 'private, no-store' } },
      )
    }
    const lignes = await prisma.operationBancaire.findMany({
      where: {
        userId,
        compteId: { not: op.compteId },
        compte: {
          devise: op.compte.devise,
          archive: false,
          OR: [{ connexionStripeId: null }, { connexionStripe: { modeTest: false } }],
        },
        brutCentimes: -op.brutCentimes,
        statut: { in: ['comptabilisee', 'ignoree'] },
        aVerifier: false,
        virementsSortants: { none: {} },
        virementsEntrants: { none: {} },
        reglements: { none: { annuleLe: null, partieBancaire: 'principal' } },
        ...(q
          ? {
              OR: [
                { libelle: { contains: q, mode: 'insensitive' as const } },
                { referenceExterne: { contains: q, mode: 'insensitive' as const } },
                { compte: { nom: { contains: q, mode: 'insensitive' as const } } },
              ],
            }
          : {}),
      },
      ...page,
      include: { compte: { select: { nom: true, devise: true } } },
    })
    return NextResponse.json(
      {
        data: lignes
          .slice(0, 50)
          .map((o) => ({
            id: o.id,
            compteId: o.compteId,
            compteNom: o.compte.nom,
            devise: o.compte.devise,
            date: o.date,
            libelle: o.libelle,
            montant: entierCentimes(o.brutCentimes) / 100,
          })),
        curseurSuivant: lignes.length > 50 ? lignes[49].id : null,
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof ErreurReglement ? e.message : 'Recherche indisponible.' },
      { status: e instanceof ErreurReglement ? e.status : 500 },
    )
  }
}
