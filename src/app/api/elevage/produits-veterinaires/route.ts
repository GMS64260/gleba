/**
 * Référentiel produits vétérinaires (PROMPT 19B §6).
 * Lecture seule pour le moment — gestion via seed en migration.
 * GET /api/elevage/produits-veterinaires?search=&espece=&autoriseAb=
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { error } = await requireAuthApi()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')
  const espece = searchParams.get('espece')
  const autoriseAb = searchParams.get('autoriseAb')

  const where: any = {}
  if (search) {
    where.OR = [
      { nom: { contains: search, mode: 'insensitive' } },
      { substanceActive: { contains: search, mode: 'insensitive' } },
    ]
  }
  if (espece) where.especesCibles = { has: espece }
  if (autoriseAb !== null && autoriseAb !== '') where.autoriseAB = autoriseAb === 'true'

  const produits = await prisma.produitVeterinaire.findMany({
    where,
    orderBy: { nom: 'asc' },
    take: 200,
  })

  return NextResponse.json({ data: produits })
}
