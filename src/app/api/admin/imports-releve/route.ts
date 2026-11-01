/**
 * API Admin — tentatives d'import de relevés bancaires (30 jours).
 * GET  /api/admin/imports-releve?statut=refuse : liste, sans le contenu des fichiers.
 * POST /api/admin/imports-releve { ids? } : relit les fichiers conservés avec le
 * lecteur en service, sans rien importer ni écrire (par défaut : refus et erreurs).
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { requireAdminApi } from '@/lib/auth-utils'
import { limiteConservation, rejouerTentativeImport } from '@/lib/comptabilite/banque/tentatives'

const STATUTS = ['importe', 'refuse', 'erreur'] as const

export async function GET(request: NextRequest) {
  const { error } = await requireAdminApi()
  if (error) return error
  const statut = request.nextUrl.searchParams.get('statut')
  const where = {
    createdAt: { gte: limiteConservation() },
    ...(STATUTS.includes(statut as (typeof STATUTS)[number]) ? { statut: statut! } : {}),
  }
  const [tentatives, avecContenu] = await Promise.all([
    prisma.tentativeImportReleve.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 300,
      select: {
        id: true,
        createdAt: true,
        compteId: true,
        nomFichier: true,
        tailleOctets: true,
        empreinte: true,
        source: true,
        statut: true,
        message: true,
        importees: true,
        dejaPresentes: true,
        user: { select: { email: true, name: true } },
      },
    }),
    prisma.tentativeImportReleve.findMany({
      where: { ...where, contenu: { not: null } },
      select: { id: true },
      take: 300,
    }),
  ])
  const conserves = new Set(avecContenu.map((t) => t.id))
  return NextResponse.json({
    data: tentatives.map((t) => ({ ...t, fichierConserve: conserves.has(t.id) })),
  })
}

const rejeuSchema = z.object({ ids: z.array(z.string().min(1).max(100)).max(300).optional() })

export async function POST(request: NextRequest) {
  const { error } = await requireAdminApi()
  if (error) return error
  const entree = rejeuSchema.safeParse(await request.json().catch(() => ({})))
  if (!entree.success) return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
  const ids = entree.data.ids?.length
    ? entree.data.ids
    : (
        await prisma.tentativeImportReleve.findMany({
          where: {
            createdAt: { gte: limiteConservation() },
            statut: { in: ['refuse', 'erreur'] },
            contenu: { not: null },
          },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
          take: 300,
        })
      ).map((t) => t.id)
  const resultats = []
  // Un fichier à la fois : jusqu'à 1 Mo chacun en mémoire.
  for (const id of ids) {
    const t = await prisma.tentativeImportReleve.findFirst({
      where: { id, createdAt: { gte: limiteConservation() } },
      select: { id: true, statut: true, source: true, contenu: true },
    })
    if (!t?.contenu) {
      resultats.push({ id, statutInitial: t?.statut ?? null, lisible: null, message: 'Fichier non conservé.' })
      continue
    }
    resultats.push({ id, statutInitial: t.statut, ...rejouerTentativeImport(t.contenu, t.source) })
  }
  return NextResponse.json({ data: resultats })
}
