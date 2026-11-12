/**
 * API Route pour creer les cultures en batch
 * POST /api/planification/creer-cultures
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi, getUserId } from '@/lib/auth-utils'
import { creerCulturesBatch } from '@/lib/planification'
import { invalidateKpi } from '@/lib/kpi'
import { z } from 'zod'

/** Plafond d'un lot : bien au-delà d'une exploitation réelle, en deçà d'un envoi abusif. */
const LOT_MAX = 500

// Mêmes bornes que la création unitaire (POST /api/cultures) : une année
// décimale ou hors plage partait jusqu'à Prisma et revenait en erreur 500.
const creerCulturesSchema = z.object({
  cultures: z.array(z.object({
    plancheId: z.string().min(1).max(200),
    itpId: z.string().min(1).max(200),
    annee: z.number().int().min(2000).max(2100),
    varieteId: z.string().min(1).max(200).optional(),
  })).max(LOT_MAX),
})

export async function POST(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  const userId = getUserId(session)
  try {
    const body = await request.json()

    // Validation
    const validationResult = creerCulturesSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    const { cultures } = validationResult.data

    if (cultures.length === 0) {
      return NextResponse.json(
        { error: 'Aucune culture à créer' },
        { status: 400 }
      )
    }

    // Les indicateurs maraîchage sont mémorisés cinq minutes par compte : sans
    // cela, l'accueil et le tableau de bord ignoraient les cultures du lot.
    // Périmés aussi quand le lot échoue : une erreur ne dit pas à coup sûr que
    // rien n'a été écrit (validation de la transaction, délai dépassé).
    let result: Awaited<ReturnType<typeof creerCulturesBatch>>
    try {
      result = await creerCulturesBatch(userId, cultures)
    } catch (erreurLot) {
      invalidateKpi(userId)
      throw erreurLot
    }
    if (result.created > 0) invalidateKpi(userId)

    return NextResponse.json({
      success: true,
      created: result.created,
      cultures: result.cultures,
      // Lignes demandées mais non créées, avec leur motif : sans elles, l'écran
      // annonçait un nombre de créations inférieur à la demande sans expliquer
      // l'écart.
      ignorees: result.ignorees,
      // Lignes créées sans vérification de l'occupation (espacement entre rangs
      // inconnu), comme l'avertissement de la création unitaire.
      avertissements: result.avertissements ?? [],
      demandees: cultures.length,
    }, { status: 201 })
  } catch (error) {
    console.error('POST /api/planification/creer-cultures error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création des cultures', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
