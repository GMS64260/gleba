/**
 * API pour supprimer toutes les données utilisateur
 * DELETE /api/user/delete-data
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthApi, getUserId } from '@/lib/auth-utils'

export async function DELETE(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = getUserId(session)

    // Supprimer toutes les données utilisateur
    // Ordre important pour respecter les contraintes de clés étrangères
    const results = await prisma.$transaction(async (tx) => {
      // 1. Irrigations planifiées (dépendent de cultures)
      const irrigations = await tx.irrigationPlanifiee.deleteMany({
        where: { userId },
      })

      // 2. Récoltes (dépendent de cultures)
      const recoltes = await tx.recolte.deleteMany({
        where: { userId },
      })

      // 3. Cultures (dépendent de planches)
      const cultures = await tx.culture.deleteMany({
        where: { userId },
      })

      // 4. Fertilisations (dépendent de planches)
      const fertilisations = await tx.fertilisation.deleteMany({
        where: { userId },
      })

      // 5. Analyses de sol (dépendent de planches)
      const analyses = await tx.analyseSol.deleteMany({
        where: { userId },
      })

      // 6. Planches
      const planches = await tx.planche.deleteMany({
        where: { userId },
      })

      // 7. Objets jardin
      const objets = await tx.objetJardin.deleteMany({
        where: { userId },
      })

      // 8. Arbres
      const arbres = await tx.arbre.deleteMany({
        where: { userId },
      })

      // 9. Notes
      const notes = await tx.note.deleteMany({
        where: { userId },
      })

      return {
        irrigations: irrigations.count,
        recoltes: recoltes.count,
        cultures: cultures.count,
        fertilisations: fertilisations.count,
        analyses: analyses.count,
        planches: planches.count,
        objets: objets.count,
        arbres: arbres.count,
        notes: notes.count,
      }
    })

    const total = Object.values(results).reduce((sum, count) => sum + count, 0)

    return NextResponse.json({
      success: true,
      message: `${total} enregistrements supprimés`,
      details: results,
    })
  } catch (error) {
    console.error('DELETE /api/user/delete-data error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression des données', details: String(error) },
      { status: 500 }
    )
  }
}
