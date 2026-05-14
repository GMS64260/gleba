/**
 * Action en masse "Reporter" sur les soins (PROMPT 20a).
 *
 * POST /api/soins/bulk-report
 *   body: { ids: number[], days: number }  OU { ids: number[], date: 'YYYY-MM-DD' }
 *
 * Décale la date prévue de chaque soin de N jours, ou à une date cible
 * pour l'ensemble du lot. Si days est positif, la nouvelle datePrevue
 * = ancienne + days. Sinon utilise `date` comme valeur absolue.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { z } from 'zod'

const schema = z
  .object({
    ids: z.array(z.coerce.number().int().positive()).min(1).max(500),
    days: z.coerce.number().int().optional(),
    date: z.coerce.date().optional(),
  })
  .refine((d) => d.days != null || d.date != null, { message: 'days ou date requis' })

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
    }
    const { ids, days, date } = parsed.data

    if (date) {
      // Décalage absolu : tous les soins reportés à la même date
      const r = await prisma.soinAnimal.updateMany({
        where: { id: { in: ids }, userId: session.user.id },
        data: { datePrevue: date },
      })
      return NextResponse.json({ updated: r.count, mode: 'absolute' })
    }

    // Décalage relatif : on lit pour chaque soin sa datePrevue actuelle puis ajoute days
    const soins = await prisma.soinAnimal.findMany({
      where: { id: { in: ids }, userId: session.user.id, datePrevue: { not: null } },
      select: { id: true, datePrevue: true },
    })

    await prisma.$transaction(
      soins.map((s) => {
        const next = new Date(s.datePrevue!)
        next.setUTCDate(next.getUTCDate() + (days ?? 0))
        return prisma.soinAnimal.update({ where: { id: s.id }, data: { datePrevue: next } })
      })
    )

    return NextResponse.json({ updated: soins.length, mode: 'relative' })
  } catch (err) {
    console.error('POST /api/soins/bulk-report error:', err)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}
