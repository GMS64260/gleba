/**
 * API Registre Phytosanitaire
 * GET /api/tracabilite/registre-phyto?annee=2026
 * Genere le registre phytosanitaire a partir des Intervention de type "traitement_phyto"
 * Conforme a la reglementation Cerphyto
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi(request)
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const annee = parseInt(searchParams.get('annee') || new Date().getFullYear().toString())

    const userId = session!.user.id
    const startOfYear = new Date(annee, 0, 1)
    const endOfYear = new Date(annee, 11, 31, 23, 59, 59)

    // Recuperer toutes les interventions de type traitement_phyto pour l'annee
    const interventions = await prisma.intervention.findMany({
      where: {
        userId,
        type: 'traitement_phyto',
        date: { gte: startOfYear, lte: endOfYear },
      },
      include: {
        user: { select: { name: true, email: true } },
      },
      orderBy: { date: 'asc' },
    })

    // Pour chaque intervention, recuperer la culture et la planche associees
    const entries = await Promise.all(
      interventions.map(async (intervention) => {
        let cultureNom = ''
        let plancheNom = ''
        let plancheLocalisation = ''
        let especeNom = ''

        // Recuperer culture si liee
        if (intervention.cultureId) {
          const culture = await prisma.culture.findUnique({
            where: { id: intervention.cultureId },
            include: {
              espece: { select: { id: true } },
              variete: { select: { id: true } },
              planche: { select: { nom: true, ilot: true, type: true } },
            },
          })
          if (culture) {
            especeNom = culture.espece.id
            cultureNom = culture.variete
              ? `${culture.espece.id} (${culture.variete.id})`
              : culture.espece.id
            if (culture.planche) {
              plancheNom = culture.planche.nom
              plancheLocalisation = [culture.planche.ilot, culture.planche.type]
                .filter(Boolean)
                .join(' - ')
            }
          }
        }

        // Si pas de culture mais une planche directe
        if (!plancheNom && intervention.plancheId) {
          const planche = await prisma.planche.findUnique({
            where: { id: intervention.plancheId },
            select: { nom: true, ilot: true, type: true },
          })
          if (planche) {
            plancheNom = planche.nom
            plancheLocalisation = [planche.ilot, planche.type]
              .filter(Boolean)
              .join(' - ')
          }
        }

        // Si arbre
        if (intervention.arbreId) {
          const arbre = await prisma.arbre.findUnique({
            where: { id: intervention.arbreId },
            select: { nom: true, espece: true, variete: true },
          })
          if (arbre) {
            cultureNom = arbre.nom
            especeNom = arbre.espece || arbre.nom
          }
        }

        // Detecter les champs manquants obligatoires
        const champsMissing: string[] = []
        if (!intervention.produitPhyto) champsMissing.push('produitPhyto')
        if (!intervention.numAMM) champsMissing.push('numAMM')
        if (!intervention.doseAppliquee) champsMissing.push('doseAppliquee')
        if (!intervention.surfaceTraitee) champsMissing.push('surfaceTraitee')
        if (intervention.dar === null || intervention.dar === undefined) champsMissing.push('dar')
        if (!cultureNom && !plancheNom) champsMissing.push('culture/parcelle')

        return {
          id: intervention.id,
          date: intervention.date.toISOString(),
          culture: cultureNom || 'Non renseigne',
          espece: especeNom,
          parcelle: plancheNom || 'Non renseigne',
          localisation: plancheLocalisation,
          nuisibleCible: intervention.cibleTraitement || null,
          produit: intervention.produitPhyto || null,
          numAMM: intervention.numAMM || null,
          doseAppliquee: intervention.doseAppliquee || null,
          uniteDose: intervention.uniteDose || null,
          surfaceTraitee: intervention.surfaceTraitee || null,
          dar: intervention.dar ?? null,
          delaiReentree: intervention.delaiReentree || null,
          conditionsMeteo: intervention.conditionsMeteo || null,
          applicateur: intervention.user.name || intervention.user.email,
          intrantNumLot: intervention.intrantNumLot || null,
          notes: intervention.notes || null,
          description: intervention.description || null,
          champsManquants: champsMissing,
          complet: champsMissing.length === 0,
        }
      })
    )

    // Stats resume
    const produitsUtilises = new Set(entries.filter(e => e.produit).map(e => e.produit))
    const surfaceTotale = entries.reduce((sum, e) => sum + (e.surfaceTraitee || 0), 0)
    const nbIncomplets = entries.filter(e => !e.complet).length

    return NextResponse.json({
      registre: entries,
      stats: {
        totalTraitements: entries.length,
        produitsUtilises: Array.from(produitsUtilises),
        nbProduitsDistincts: produitsUtilises.size,
        surfaceTotalTraitee: surfaceTotale,
        nbIncomplets,
        periodeDebut: entries.length > 0 ? entries[0].date : null,
        periodeFin: entries.length > 0 ? entries[entries.length - 1].date : null,
      },
      meta: {
        annee,
        generatedAt: new Date().toISOString(),
        type: 'registre_phytosanitaire',
      },
    })
  } catch (err) {
    console.error('GET /api/tracabilite/registre-phyto error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la generation du registre phytosanitaire' },
      { status: 500 }
    )
  }
}
