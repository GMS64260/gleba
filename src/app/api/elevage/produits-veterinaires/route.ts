/**
 * Référentiel produits vétérinaires (PROMPT 19B §6).
 * Lecture seule pour le moment — gestion via seed en migration.
 * GET /api/elevage/produits-veterinaires?search=&espece=&autoriseAb=
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { resoudreDelaisVeterinaires } from '@/lib/elevage/delais-veterinaires'

export async function GET(request: NextRequest) {
  const { error } = await requireAuthApi()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')
  const codeEspece = searchParams.get('espece')
  const autoriseAb = searchParams.get('autoriseAb')
  const especeId = searchParams.get('especeId')

  const where: any = {}
  if (search) {
    where.OR = [
      { nom: { contains: search, mode: 'insensitive' } },
      { substanceActive: { contains: search, mode: 'insensitive' } },
    ]
  }
  if (codeEspece) where.especesCibles = { has: codeEspece }
  if (autoriseAb !== null && autoriseAb !== '') where.autoriseAB = autoriseAb === 'true'

  const produits = await prisma.produitVeterinaire.findMany({
    where,
    orderBy: { nom: 'asc' },
    take: 200,
    include: {
      delaisParEspece: especeId
        ? { where: { especeAnimaleId: especeId } }
        : false,
    },
  })

  const espece = especeId
    ? await prisma.especeAnimale.findUnique({
        where: { id: especeId },
        select: { id: true, nom: true, categorieReglementaire: true },
      })
    : null

  return NextResponse.json({
    data: produits.map((produit) => {
      const delaisEffectifs = resoudreDelaisVeterinaires(produit, espece)
      return {
        ...produit,
        tempsAttenteLaitJ: delaisEffectifs.tempsAttenteLaitJ,
        tempsAttenteViandeJ: delaisEffectifs.tempsAttenteViandeJ,
        delaiAttenteSource: delaisEffectifs.source,
        couvertAmmPourEspece: delaisEffectifs.couvertAmm,
      }
    }),
    meta: { especeId: espece?.id ?? null },
  })
}
