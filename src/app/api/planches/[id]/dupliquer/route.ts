/**
 * POST /api/planches/[id]/dupliquer   body: { nombre?: number }  (1 à 20)
 *
 * Crée `nombre` copies de la planche : même terrain (dimensions, orientation,
 * îlot, parcelle, type, irrigation, sol, rétention, rotation…), noms numérotés
 * depuis le nom de base, positions côte à côte sur le plan. La règle de ce qui
 * se copie vit dans `src/lib/planches/copie.ts`.
 *
 * Ticket QA du 2026-10-19 : le plan 2D recopiait lui-même les seules colonnes
 * qu'il avait chargées et passait par `POST /api/planches` ; îlot, type, sol,
 * rétention et rotation étaient perdus. La source est désormais relue en base
 * par la route, bornée à son propriétaire.
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthApi } from '@/lib/auth-utils'
import { invalidateKpi } from '@/lib/kpi'
import { resoudreIdPlanche } from '@/lib/planches/resolution'
import {
  MAX_COPIES_PLANCHE,
  SELECT_SOURCE_COPIE_PLANCHE,
  attributsCopiePlanche,
  planCopiesPlanche,
} from '@/lib/planches/copie'
import { plancheSchema } from '@/lib/validations/planche'

type RouteParams = { params: Promise<{ id: string }> }

/** Bornes de la création ordinaire : nom de 50 caractères, position dans le plan. */
const copieSchema = plancheSchema.pick({ nom: true, posX: true, posY: true })

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const userId = session!.user.id

  try {
    const { id } = await params
    const reference = decodeURIComponent(id)

    const body = await request.json().catch(() => ({}))
    const nombre = Number(body?.nombre ?? 1)
    if (!Number.isInteger(nombre) || nombre < 1 || nombre > MAX_COPIES_PLANCHE) {
      return NextResponse.json(
        {
          error: `Le nombre de copies doit être un entier entre 1 et ${MAX_COPIES_PLANCHE}`,
          champ: 'nombre',
        },
        { status: 400 }
      )
    }

    const plancheId = await resoudreIdPlanche(prisma, reference, userId)
    const source = plancheId
      ? await prisma.planche.findFirst({
          where: { id: plancheId, userId },
          select: SELECT_SOURCE_COPIE_PLANCHE,
        })
      : null
    if (!source) {
      return NextResponse.json({ error: 'Planche non trouvée' }, { status: 404 })
    }

    // Tous les noms du compte, pas seulement ceux de la parcelle affichée :
    // l'unicité (nom, propriétaire) vaut pour tout le compte.
    const existants = await prisma.planche.findMany({ where: { userId }, select: { nom: true } })
    const plan = planCopiesPlanche(source, nombre, existants.map((p) => p.nom))

    for (const copie of plan) {
      const verifie = copieSchema.safeParse(copie)
      if (!verifie.success) {
        const champ = String(verifie.error.issues[0]?.path[0] ?? 'nom')
        return NextResponse.json(
          {
            error:
              champ === 'nom'
                ? `Nom de copie trop long : « ${copie.nom} » dépasse 50 caractères. Raccourcissez le nom de la planche source.`
                : 'Les copies sortiraient du plan (100 m au plus de l\'origine) : dupliquez moins de planches ou déplacez la source.',
            champ: champ === 'nom' ? 'nom' : 'nombre',
          },
          { status: 400 }
        )
      }
    }

    const attributs = attributsCopiePlanche(source)
    const creees = await prisma.$transaction(
      plan.map((copie) =>
        prisma.planche.create({
          data: {
            ...attributs,
            userId,
            nom: copie.nom,
            posX: copie.posX,
            posY: copie.posY,
          },
          select: { id: true, nom: true },
        })
      )
    )

    invalidateKpi(userId)
    return NextResponse.json({ planches: creees }, { status: 201 })
  } catch (err) {
    // Une planche du même nom créée entre la lecture et l'écriture.
    if ((err as { code?: string })?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Une planche porte déjà ce nom : réessayez la duplication.', champ: 'nom' },
        { status: 409 }
      )
    }
    console.error('POST /api/planches/[id]/dupliquer error:', err)
    return NextResponse.json({ error: 'Erreur lors de la duplication de la planche' }, { status: 500 })
  }
}
