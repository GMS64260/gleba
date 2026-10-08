/**
 * Rendement, unité et objectif annuel PROPRES À LA FERME, pour une espèce.
 *
 * PUT /api/especes/[id]/mon-rendement
 * DELETE /api/especes/[id]/mon-rendement  (revenir au catalogue)
 *
 * Pourquoi une route à part du PUT de l'espèce. Modifier une espèce du catalogue
 * officiel est refusé à un membre (403), et c'est la bonne règle : le référentiel
 * est partagé par 115 comptes. Mais le 2026-08-20, cette règle a rendu
 * inatteignable la fonctionnalité qu'un utilisateur venait de demander — choisir
 * l'unité de son rendement — puisque les 25 fleurs coupées qu'il cultive
 * appartiennent au catalogue. Ici l'écriture porte sur SES données
 * (`UserStockEspece`), donc elle est ouverte sur toute espèce qu'il peut voir.
 *
 * Un rendement est de toute façon propre au sol et à la conduite : le catalogue
 * n'en donne qu'un ordre de grandeur.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { requireAuthApi } from '@/lib/auth-utils'
import { visibiliteReferentiel } from '@/lib/referentiel-communaute'
import { UNITE_RENDEMENT, UNITE_RENDEMENT_LABELS, rendementMaximum } from '@/lib/validations/espece'
import { rendementEffectif } from '@/lib/recolte/rendement-effectif'

interface RouteParams {
  params: Promise<{ id: string }>
}

const schema = z.object({
  // null = « je m'en remets au catalogue » pour ce champ.
  rendement: z.number().min(0).max(100000).nullable().optional(),
  uniteRendement: z.enum(UNITE_RENDEMENT).nullable().optional(),
  objectifAnnuel: z.number().min(0).nullable().optional(),
})

/**
 * Même borne de vraisemblance que la fiche espèce, contre l'unité que le
 * payload établit. Quand il ne la porte pas, elle est en base (surcharge ou
 * catalogue) : on la résout avant de valider, cf. `bornerRendementEffectif`.
 */
function erreurBorne(rendement: number, unite: typeof UNITE_RENDEMENT[number]): string | null {
  const maximum = rendementMaximum(unite)
  return rendement > maximum
    ? `Rendement invraisemblable : maximum ${maximum} ${UNITE_RENDEMENT_LABELS[unite]}`
    : null
}

/** Même décodage défensif que la fiche : l'id peut arriver percent-encodé. */
function decodeId(id: string): string {
  try {
    const decoded = decodeURIComponent(id)
    return decoded !== id ? decoded : id
  } catch {
    return id
  }
}

async function especeVisible(userId: string, especeId: string) {
  return prisma.espece.findFirst({
    where: { AND: [{ id: especeId }, visibiliteReferentiel(userId)] },
    select: { id: true, rendement: true, uniteRendement: true },
  })
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const userId = session!.user.id

  try {
    const { id } = await params
    const especeId = decodeId(id)
    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // La visibilité du référentiel s'applique : on ne déclare pas un rendement
    // sur l'espèce privée de quelqu'un d'autre, même dans ses propres données.
    const espece = await especeVisible(userId, especeId)
    if (!espece) {
      return NextResponse.json({ error: `Espèce "${especeId}" non trouvée` }, { status: 404 })
    }

    const { rendement, uniteRendement, objectifAnnuel } = parsed.data

    if (rendement != null) {
      // Unité contre laquelle juger la valeur : celle du payload, sinon celle
      // déjà enregistrée chez moi, sinon celle du catalogue.
      const existante = uniteRendement === undefined
        ? await prisma.userStockEspece.findUnique({
            where: { userId_especeId: { userId, especeId: espece.id } },
            select: { uniteRendement: true },
          })
        : null
      const uniteJugee = (uniteRendement
        ?? existante?.uniteRendement
        ?? espece.uniteRendement
        ?? 'kg_m2') as typeof UNITE_RENDEMENT[number]
      const erreur = UNITE_RENDEMENT.includes(uniteJugee) ? erreurBorne(rendement, uniteJugee) : null
      if (erreur) {
        return NextResponse.json(
          { error: 'Données invalides', details: { fieldErrors: { rendement: [erreur] } } },
          { status: 400 }
        )
      }
    }

    const ligne = await prisma.userStockEspece.upsert({
      where: { userId_especeId: { userId, especeId: espece.id } },
      create: {
        userId,
        especeId: espece.id,
        ...(rendement !== undefined ? { rendement } : {}),
        ...(uniteRendement !== undefined ? { uniteRendement } : {}),
        ...(objectifAnnuel !== undefined ? { objectifAnnuel } : {}),
      },
      update: {
        ...(rendement !== undefined ? { rendement } : {}),
        ...(uniteRendement !== undefined ? { uniteRendement } : {}),
        ...(objectifAnnuel !== undefined ? { objectifAnnuel } : {}),
      },
      select: { rendement: true, uniteRendement: true, objectifAnnuel: true },
    })

    return NextResponse.json({
      monRendement: ligne,
      rendementEffectif: rendementEffectif(espece, ligne),
    })
  } catch (err) {
    console.error('PUT /api/especes/[id]/mon-rendement error:', err)
    return NextResponse.json({ error: 'Erreur lors de l\'enregistrement' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const userId = session!.user.id

  try {
    const { id } = await params
    const especeId = decodeId(id)
    const espece = await especeVisible(userId, especeId)
    if (!espece) {
      return NextResponse.json({ error: `Espèce "${especeId}" non trouvée` }, { status: 404 })
    }

    // On ne supprime pas la ligne : elle porte aussi l'inventaire et le prix.
    // Seuls le rendement et son unité retournent au catalogue ; l'objectif
    // annuel est une donnée de la ferme sans équivalent au catalogue, il reste.
    const existe = await prisma.userStockEspece.findUnique({
      where: { userId_especeId: { userId, especeId: espece.id } },
      select: { id: true },
    })
    if (existe) {
      await prisma.userStockEspece.update({
        where: { userId_especeId: { userId, especeId: espece.id } },
        data: { rendement: null, uniteRendement: null },
      })
    }

    return NextResponse.json({
      monRendement: null,
      rendementEffectif: rendementEffectif(espece, null),
    })
  } catch (err) {
    console.error('DELETE /api/especes/[id]/mon-rendement error:', err)
    return NextResponse.json({ error: 'Erreur lors de la remise à zéro' }, { status: 500 })
  }
}
