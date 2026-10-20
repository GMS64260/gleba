/**
 * Référentiel produits vétérinaires (PROMPT 19B §6).
 * Lecture seule pour le moment — gestion via seed en migration.
 * GET /api/elevage/produits-veterinaires?search=&espece=&autoriseAb=
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { resoudreDelaisVeterinaires } from '@/lib/elevage/delais-veterinaires'
import { visibiliteReferentiel } from '@/lib/referentiel-communaute'

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
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

  // Espèce visible du compte seulement : le profil privé d'un autre compte
  // répond comme un id inconnu (délais du produit, `meta.especeId` null).
  const espece = especeId
    ? await prisma.especeAnimale.findFirst({
        where: { id: especeId, AND: [visibiliteReferentiel(session!.user.id)] },
        select: { id: true, nom: true, categorieReglementaire: true },
      })
    : null

  const produits = await prisma.produitVeterinaire.findMany({
    where,
    orderBy: { nom: 'asc' },
    take: 200,
    include: {
      delaisParEspece: espece
        ? { where: { especeAnimaleId: espece.id } }
        : false,
    },
  })

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
