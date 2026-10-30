/**
 * API pour supprimer toutes les données utilisateur
 * DELETE /api/user/delete-data
 */

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthApi } from '@/lib/auth-utils'
import { getUserId, refusSiPasProprietaire } from '@/lib/exploitation/garde-session'
import { MESSAGES_REFUS_DEMO, refusSiCompteDemo } from '@/lib/demo-garde'
import { supprimerMesuresBrutesDuCompte } from '@/lib/capteurs/agregats'

export async function DELETE() {
  const { error, session } = await requireAuthApi()
  if (error) return error
  // Vider l'exploitation n'est jamais le geste d'un compte invité.
  const refus = refusSiPasProprietaire(session)
  if (refus) return refus

  try {
    const userId = getUserId(session)

    // Le compte de démonstration est partagé, identifiants publics : un
    // visiteur pouvait vider la ferme de démonstration pour tous les suivants.
    const refusDemo = await refusSiCompteDemo(userId, MESSAGES_REFUS_DEMO.viderDonnees)
    if (refusDemo) return refusDemo

    // Seules les livraisons (bons, factures) lient un lot à un document à
    // conserver ; une perte ou un usage interne du verger part avec son lot.
    if (await prisma.mouvementStockCommercial.count({ where: { userId, nature: 'livraison' } })) return NextResponse.json({ error: 'Ces lots sont liés à des bons ou factures. Ils doivent être conservés avec leurs documents commerciaux ; l’effacement partiel est impossible.' }, { status: 409 })

    // Mesures brutes des capteurs d'abord, par lots validés chacun seul
    // (revue du 2026-10-30) : 90 jours d'historique comptent des centaines de
    // milliers de lignes, que la cascade faisait supprimer dans la transaction
    // ci-dessous, au délai par défaut de 5 s. Les supprimer d'abord va dans le
    // sens de la demande ; si la suite échoue, un nouvel essai la termine.
    const mesuresCapteurs = await supprimerMesuresBrutesDuCompte(userId)

    // Supprimer toutes les données utilisateur
    // Ordre important pour respecter les contraintes de clés étrangères
    const results = await prisma.$transaction(async (tx) => {
      // 0. Sorties physiques des lots du verger (pertes, usages internes) :
      // elles référencent leurs lots sans cascade (revue du 2026-10-30).
      await tx.mouvementStockCommercial.deleteMany({ where: { userId, nature: { not: 'livraison' } } })

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

      // 10. Capteurs connectés (2026-10-23) : les connecteurs, et en cascade
      // leurs capteurs, positions, agrégats journaliers et le brut arrivé
      // depuis la suppression par lots. Leurs jetons cessent aussitôt de
      // fonctionner : un webhook resté branché ne réécrit rien.
      const connecteursCapteurs = await tx.connecteurCapteurs.deleteMany({
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
        connecteursCapteurs: connecteursCapteurs.count,
      }
    })

    const details = { ...results, mesuresCapteurs }
    const total = Object.values(details).reduce((sum, count) => sum + count, 0)

    return NextResponse.json({
      success: true,
      message: `${total} enregistrements supprimés`,
      details,
    })
  } catch (error) {
    console.error('DELETE /api/user/delete-data error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression des données', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
