/**
 * API Indicateurs de reproduction (PROMPT 23).
 * GET /api/elevage/repro-indicateurs?annee=2026
 *
 * Métriques de campagne (fertilité, prolificité, mortinatalité) sur l'année
 * sélectionnée + métriques structurelles (IVV, âge au premier part) sur tout
 * l'historique. Dérivé des saillies et naissances — aucune migration.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { indicateursRepro } from '@/lib/elevage/repro-indicateurs'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const annee = parseInt(searchParams.get('annee') || `${new Date().getFullYear()}`, 10) || new Date().getFullYear()
    const userId = session.user.id
    const debut = new Date(annee, 0, 1)
    const fin = new Date(annee, 11, 31, 23, 59, 59)

    const [sailliesAnnee, naissancesAnnee, naissancesAll, femelles] = await Promise.all([
      prisma.saillie.findMany({
        where: { userId, date: { gte: debut, lte: fin } },
        select: { femelleId: true, date: true, statut: true },
      }),
      prisma.naissanceAnimale.findMany({
        where: { userId, date: { gte: debut, lte: fin } },
        select: { mereId: true, date: true, nombreNes: true, nombreVivants: true },
      }),
      prisma.naissanceAnimale.findMany({
        where: { userId },
        select: { mereId: true, date: true, nombreNes: true, nombreVivants: true },
      }),
      prisma.animal.findMany({
        where: { userId, sexe: 'femelle' },
        select: { id: true, dateNaissance: true },
      }),
    ])

    // Métriques de campagne sur l'année
    const periode = indicateursRepro(sailliesAnnee, naissancesAnnee, [])
    // Métriques structurelles sur tout l'historique
    const historique = indicateursRepro([], naissancesAll, femelles)

    return NextResponse.json({
      annee,
      periode: {
        nbSaillies: periode.nbSaillies,
        nbSailliesAvecIssue: periode.nbSailliesAvecIssue,
        nbMiseBas: periode.nbMiseBas,
        tauxFertilite: periode.tauxFertilite,
        prolificite: periode.prolificite,
        prolificiteVivants: periode.prolificiteVivants,
        mortaliteNaissance: periode.mortaliteNaissance,
      },
      historique: {
        ivvMoyenJours: historique.ivvMoyenJours,
        nbFemellesIvv: historique.nbFemellesIvv,
        agePremierPartJours: historique.agePremierPartJours,
        nbFemellesAgePremierPart: historique.nbFemellesAgePremierPart,
      },
    })
  } catch (err) {
    console.error('GET /api/elevage/repro-indicateurs error:', err)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}
