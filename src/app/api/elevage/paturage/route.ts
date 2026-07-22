import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'

const patchSchema = z.object({
  parcelleId: z.string().min(1),
  disponibiliteFourragereKgMsHa: z.coerce.number().min(0).max(100_000).nullable().optional(),
  eauDisponible: z.boolean().nullable().optional(),
  etatCloture: z.enum(['bon', 'a_surveiller', 'a_reparer']).nullable().optional(),
})
const ugb = (nom: string) => {
  const n = nom.toLowerCase()
  if (n.includes('bovin') || n.includes('vache')) return 1
  if (n.includes('équin') || n.includes('cheval')) return 0.8
  if (n.includes('ovin') || n.includes('mouton') || n.includes('caprin') || n.includes('chèvre')) return 0.15
  if (n.includes('porc')) return 0.3
  return 0.02
}

export async function GET() {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const userId = session.user.id
  const [parcelles, lots, mouvements] = await Promise.all([
    prisma.parcelleGeo.findMany({
      where: { userId, OR: [{ couches: { has: 'PATURAGE' } }, { usage: { contains: 'prairie', mode: 'insensitive' } }, { lotsAnimaux: { some: {} } }] },
      select: { id: true, nom: true, surface: true, disponibiliteFourragereKgMsHa: true, eauDisponible: true, etatCloture: true },
      orderBy: { nom: 'asc' },
    }),
    prisma.lotAnimaux.findMany({ where: { userId, statut: 'actif' }, select: { id: true, nom: true, quantiteActuelle: true, parcelleGeoId: true, especeAnimale: { select: { nom: true } } } }),
    prisma.mouvementCheptel.findMany({ where: { userId, lotId: { not: null } }, select: { lotId: true, parcelleAvantId: true, parcelleApresId: true, date: true }, orderBy: { date: 'asc' } }),
  ])
  const now = new Date()
  const jours = (d: Date) => Math.max(0, Math.floor((now.getTime() - d.getTime()) / 86_400_000))
  const data = parcelles.map(p => {
    const presents = lots.filter(l => l.parcelleGeoId === p.id)
    const totalUgb = presents.reduce((sum, l) => sum + l.quantiteActuelle * ugb(l.especeAnimale.nom), 0)
    const mv = mouvements.filter(m => m.parcelleAvantId === p.id || m.parcelleApresId === p.id)
    const derniereEntree = [...mv].reverse().find(m => m.parcelleApresId === p.id)?.date ?? null
    const derniereSortie = [...mv].reverse().find(m => m.parcelleAvantId === p.id)?.date ?? null
    const occupee = presents.length > 0
    return {
      ...p, lots: presents, totalTetes: presents.reduce((s, l) => s + l.quantiteActuelle, 0),
      ugb: Math.round(totalUgb * 100) / 100,
      chargementUgbHa: p.surface && p.surface > 0 ? Math.round(totalUgb / p.surface * 100) / 100 : null,
      joursOccupation: occupee && derniereEntree ? jours(derniereEntree) : null,
      joursRepos: !occupee && derniereSortie ? jours(derniereSortie) : null,
      fourrageDisponibleKgMs: p.surface && p.disponibiliteFourragereKgMsHa != null ? Math.round(p.surface * p.disponibiliteFourragereKgMsHa) : null,
    }
  })
  return NextResponse.json({ data, lotsSansParcelle: lots.filter(l => !l.parcelleGeoId) })
}

export async function PATCH(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const parsed = patchSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
  const { parcelleId, ...data } = parsed.data
  const owned = await prisma.parcelleGeo.findFirst({ where: { id: parcelleId, userId: session.user.id }, select: { id: true } })
  if (!owned) return NextResponse.json({ error: 'Parcelle introuvable' }, { status: 404 })
  const result = await prisma.parcelleGeo.update({ where: { id: parcelleId }, data })
  return NextResponse.json({ data: result })
}
