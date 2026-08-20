/**
 * POST /api/planches/[id]/convertir-en-objet — reclasse une planche en objet du plan.
 *
 * Le plan 2D n'ayant longtemps offert aucun élément bâti, l'outil « planche »
 * était le seul à savoir dessiner une forme : des murs et des clôtures ont donc
 * été saisis comme planches de 10 cm de large. Ces entrées polluent la liste des
 * planches, la planification et les rotations, et le plan les dessine comme des
 * cultures.
 *
 * La conversion préserve le travail de placement (position, dimensions,
 * orientation, parcelle) au lieu d'obliger à tout supprimer puis tout redessiner.
 * Elle est refusée dès que la planche porte un historique agronomique : dans ce
 * cas ce n'est pas une erreur de saisie, c'est une vraie planche.
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthApi } from '@/lib/auth-utils'
import { invalidateKpi } from '@/lib/kpi'
import { resoudreIdPlanche } from '@/lib/planches/resolution'
import { TYPES_OBJETS, typeObjet } from '@/lib/jardin/objets-plan'

type RouteParams = { params: Promise<{ id: string }> }

/** Une planche sans dimension saisie ne doit pas produire un objet invisible. */
const LARGEUR_MINI = 0.1
const LONGUEUR_MINI = 0.5

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const userId = session!.user.id

  try {
    const { id } = await params
    const reference = decodeURIComponent(id)

    const body = await request.json().catch(() => ({}))
    const typeDemande = typeof body?.type === 'string' ? body.type : ''
    // Un type inconnu deviendrait « autre » en silence : on le refuse, la
    // reclassification n'a d'intérêt que si elle est exacte.
    if (!TYPES_OBJETS.some(t => t.value === typeDemande)) {
      return NextResponse.json(
        {
          error: 'Type d\'objet inconnu',
          details: { attendus: TYPES_OBJETS.map(t => t.value) },
        },
        { status: 400 }
      )
    }

    const plancheId = await resoudreIdPlanche(prisma, reference, userId)
    const planche = plancheId
      ? await prisma.planche.findFirst({
          where: { id: plancheId, userId },
          include: {
            _count: { select: { cultures: true, fertilisations: true, analyses: true } },
          },
        })
      : null

    if (!planche) {
      return NextResponse.json({ error: `Planche "${reference}" non trouvée` }, { status: 404 })
    }

    // Garde volontairement plus stricte que la suppression, qui ne regarde que
    // les cultures : une fertilisation serait supprimée en cascade et une
    // analyse de sol perdrait sa planche. Ces trois traces prouvent un usage
    // maraîcher réel, donc une conversion faite par erreur.
    const { cultures, fertilisations, analyses } = planche._count
    if (cultures > 0 || fertilisations > 0 || analyses > 0) {
      return NextResponse.json(
        {
          error: `« ${planche.nom} » a un historique de culture : elle ne peut pas être reclassée en objet du plan.`,
          details: { cultures, fertilisations, analyses },
        },
        { status: 409 }
      )
    }

    const cible = typeObjet(typeDemande)
    const largeur = Math.max(planche.largeur ?? cible.gabarit.largeur, LARGEUR_MINI)
    const longueur = Math.max(planche.longueur ?? cible.gabarit.longueur, LONGUEUR_MINI)

    // Transaction : jamais de planche supprimée sans son objet, jamais de
    // doublon si la suppression échoue.
    const objet = await prisma.$transaction(async tx => {
      const cree = await tx.objetJardin.create({
        data: {
          userId,
          nom: planche.nom,
          type: cible.value,
          largeur,
          longueur,
          posX: planche.posX ?? 0,
          posY: planche.posY ?? 0,
          rotation2D: planche.rotation2D ?? 0,
          notes: planche.notes,
          parcelleGeoId: planche.parcelleGeoId,
        },
      })
      await tx.planche.delete({ where: { id: planche.id } })
      return cree
    })

    invalidateKpi(userId)
    return NextResponse.json({
      objet,
      converti: { plancheId: planche.id, nom: planche.nom, type: cible.value, label: cible.label },
    })
  } catch (error) {
    console.error('POST /api/planches/[id]/convertir-en-objet error:', error)
    return NextResponse.json({ error: 'Erreur lors de la conversion de la planche' }, { status: 500 })
  }
}
