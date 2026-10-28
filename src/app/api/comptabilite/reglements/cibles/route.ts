import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { chargerSoldesReglements } from '@/lib/comptabilite/reglements'
import {
  cleFacture,
  cleMiroirReglement,
  cleSourceReglement,
} from '@/lib/comptabilite/cle-reglement'
import { enCentimes, soldeReglement } from '@/lib/comptabilite/monnaie'
import { deviseDuTerritoire } from '@/lib/territoires'
export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const userId = session.user.id,
    q = (request.nextUrl.searchParams.get('q') || '').trim().slice(0, 100)
  const [factures, elevage, ventes, depenses, exploitation] = await Promise.all([
    prisma.facture.findMany({
      where: {
        userId,
        statut: { in: ['emise', 'payee'] },
        type: { not: 'avoir' },
        ...(q
          ? {
              OR: [
                { numero: { contains: q, mode: 'insensitive' as const } },
                { clientNom: { contains: q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      orderBy: [{ statut: 'asc' }, { date: 'desc' }],
      take: 100,
    }),
    prisma.venteProduit.findMany({
      where: {
        userId,
        annule: false,
        factureId: null,
        ...(q
          ? {
              OR: [
                { description: { contains: q, mode: 'insensitive' as const } },
                { client: { contains: q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      orderBy: [{ paye: 'asc' }, { date: 'desc' }],
      take: 100,
    }),
    prisma.venteManuelle.findMany({
      where: {
        userId,
        NOT: [
          { auto: true, sourceType: 'vente_produit' },
          { auto: true, sourceType: 'reservation_elevage' },
        ],
        ...(q ? { description: { contains: q, mode: 'insensitive' as const } } : {}),
      },
      orderBy: [{ paye: 'asc' }, { date: 'desc' }],
      take: 100,
    }),
    prisma.depenseManuelle.findMany({
      where: {
        userId,
        comptable: true,
        ...(q ? { description: { contains: q, mode: 'insensitive' as const } } : {}),
      },
      orderBy: [{ paye: 'asc' }, { date: 'desc' }],
      take: 100,
    }),
    prisma.exploitation.findUnique({ where: { userId }, select: { territoire: true } }),
  ])
  const avoirs = factures.length
    ? await prisma.facture.findMany({
        where: {
          userId,
          type: 'avoir',
          statut: { in: ['emise', 'payee'] },
          factureOrigineId: { in: factures.map((f) => f.id) },
        },
        select: { factureOrigineId: true, totalTTC: true },
      })
    : []
  const credits = new Map<number, number>()
  for (const a of avoirs)
    if (a.factureOrigineId)
      credits.set(
        a.factureOrigineId,
        (credits.get(a.factureOrigineId) || 0) + enCentimes(a.totalTTC),
      )
  const cibles = [
    ...factures.map((f) => ({
      type: 'Facture',
      id: f.id,
      cle: cleFacture(f.id),
      libelle: f.numero + ' · ' + f.clientNom,
      sens: 'encaissement',
      total: Math.max(0, enCentimes(f.totalTTC) - (credits.get(f.id) || 0)),
      paye: f.statut === 'payee',
    })),
    ...elevage.map((v) => ({
      type: 'VenteProduit',
      id: v.id,
      cle: cleSourceReglement('vente', 'vente_produit', v.id),
      libelle: v.description || 'Vente ' + v.type + ' · ' + (v.client || ''),
      sens: 'encaissement',
      total: enCentimes(v.prixTotal),
      paye: v.paye,
    })),
    ...ventes.map((v) => ({
      type: 'VenteManuelle',
      id: v.id,
      cle: cleMiroirReglement('vente', v),
      libelle: v.description,
      sens: 'encaissement',
      total: enCentimes(v.montant),
      paye: v.paye,
    })),
    ...depenses.map((d) => ({
      type: 'DepenseManuelle',
      id: d.id,
      cle: cleMiroirReglement('depense', d),
      libelle: d.description,
      sens: 'decaissement',
      total: enCentimes(d.montant),
      paye: d.paye,
    })),
  ]
  const suivis = await chargerSoldesReglements(
      userId,
      cibles.map((c) => c.cle),
    ),
    devise = deviseDuTerritoire(exploitation?.territoire)
  return NextResponse.json({
    data: cibles.map((c) => {
      const s = suivis.get(c.cle)
      return {
        type: c.type,
        id: c.id,
        libelle: c.libelle,
        sens: c.sens,
        devise,
        ...soldeReglement(c.total, s?.regleCentimes ?? 0, c.paye, Boolean(s)),
      }
    }),
  })
}
