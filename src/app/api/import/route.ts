/**
 * API Import des données
 * POST /api/import
 * Importe les données pour l'utilisateur connecté
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthApi } from '@/lib/auth-utils'

interface ImportData {
  version?: string
  familles?: Array<{ id: string; intervalle?: number | null; couleur?: string | null }>
  especes?: Array<{
    id: string
    familleId?: string | null
    nomLatin?: string | null
    rendement?: number | null
    vivace?: boolean
    besoinN?: number | null
    besoinP?: number | null
    besoinK?: number | null
    besoinEau?: number | null
    aPlanifier?: boolean
    couleur?: string | null
    description?: string | null
  }>
  varietes?: Array<{
    id: string
    especeId: string
    fournisseurId?: string | null
    semaineRecolte?: number | null
    dureeRecolte?: number | null
    nbGrainesG?: number | null
    prixGraine?: number | null
    stockGraines?: number | null
    bio?: boolean
    description?: string | null
  }>
  planches?: Array<{
    id: string
    rotationId?: string | null
    ilot?: string | null
    surface?: number | null
    largeur?: number | null
    longueur?: number | null
    posX?: number | null
    posY?: number | null
    rotation2D?: number | null
    planchesInfluencees?: string | null
    notes?: string | null
  }>
  cultures?: Array<{
    id: number
    especeId: string
    varieteId?: string | null
    itpId?: string | null
    plancheId?: string | null
    annee?: number | null
    dateSemis?: string | null
    datePlantation?: string | null
    dateRecolte?: string | null
    semisFait?: boolean
    plantationFaite?: boolean
    recolteFaite?: boolean
    terminee?: string | null
    quantite?: number | null
    nbRangs?: number | null
    longueur?: number | null
    notes?: string | null
  }>
  recoltes?: Array<{
    id: number
    especeId: string
    cultureId: number
    date: string
    quantite: number
    notes?: string | null
  }>
  fertilisants?: Array<{
    id: string
    n?: number | null
    p?: number | null
    k?: number | null
  }>
  fertilisations?: Array<{
    id: number
    plancheId: string
    fertilisantId: string
    date: string
    quantite: number
    notes?: string | null
  }>
  objetsJardin?: Array<{
    id: number
    nom?: string | null
    type: string
    largeur: number
    longueur: number
    posX: number
    posY: number
    rotation2D?: number
    couleur?: string | null
    notes?: string | null
  }>
}

export async function POST(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 })
    }

    const text = await file.text()
    let data: ImportData

    try {
      data = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: 'Format JSON invalide' }, { status: 400 })
    }

    const userId = session!.user.id

    // Statistiques d'import
    const stats = {
      familles: 0,
      especes: 0,
      varietes: 0,
      planches: 0,
      cultures: 0,
      recoltes: 0,
      fertilisants: 0,
      fertilisations: 0,
      objetsJardin: 0,
    }

    // Import dans l'ordre des dépendances

    // 1. Familles (référentiel global)
    if (data.familles?.length) {
      for (const item of data.familles) {
        await prisma.famille.upsert({
          where: { id: item.id },
          update: { intervalle: item.intervalle ?? 4, couleur: item.couleur },
          create: { id: item.id, intervalle: item.intervalle ?? 4, couleur: item.couleur },
        })
        stats.familles++
      }
    }

    // 2. Espèces (référentiel global)
    if (data.especes?.length) {
      for (const item of data.especes) {
        await prisma.espece.upsert({
          where: { id: item.id },
          update: {
            familleId: item.familleId,
            nomLatin: item.nomLatin,
            rendement: item.rendement,
            vivace: item.vivace,
            besoinN: item.besoinN,
            besoinP: item.besoinP,
            besoinK: item.besoinK,
            besoinEau: item.besoinEau,
            aPlanifier: item.aPlanifier,
            couleur: item.couleur,
            description: item.description,
          },
          create: {
            id: item.id,
            familleId: item.familleId,
            nomLatin: item.nomLatin,
            rendement: item.rendement,
            vivace: item.vivace ?? false,
            besoinN: item.besoinN,
            besoinP: item.besoinP,
            besoinK: item.besoinK,
            besoinEau: item.besoinEau,
            aPlanifier: item.aPlanifier ?? true,
            couleur: item.couleur,
            description: item.description,
          },
        })
        stats.especes++
      }
    }

    // 3. Variétés (référentiel global)
    if (data.varietes?.length) {
      for (const item of data.varietes) {
        const especeExists = await prisma.espece.findUnique({ where: { id: item.especeId } })
        if (!especeExists) continue

        await prisma.variete.upsert({
          where: { id: item.id },
          update: {
            especeId: item.especeId,
            fournisseurId: item.fournisseurId,
            semaineRecolte: item.semaineRecolte,
            dureeRecolte: item.dureeRecolte,
            nbGrainesG: item.nbGrainesG,
            prixGraine: item.prixGraine,
            stockGraines: item.stockGraines,
            bio: item.bio,
            description: item.description,
          },
          create: {
            id: item.id,
            especeId: item.especeId,
            fournisseurId: item.fournisseurId,
            semaineRecolte: item.semaineRecolte,
            dureeRecolte: item.dureeRecolte,
            nbGrainesG: item.nbGrainesG,
            prixGraine: item.prixGraine,
            stockGraines: item.stockGraines,
            bio: item.bio ?? false,
            description: item.description,
          },
        })
        stats.varietes++
      }
    }

    // 4. Fertilisants (référentiel global)
    if (data.fertilisants?.length) {
      for (const item of data.fertilisants) {
        await prisma.fertilisant.upsert({
          where: { id: item.id },
          update: { n: item.n, p: item.p, k: item.k },
          create: { id: item.id, n: item.n, p: item.p, k: item.k },
        })
        stats.fertilisants++
      }
    }

    // 5. Planches (données utilisateur)
    if (data.planches?.length) {
      for (const item of data.planches) {
        // Vérifier si la planche existe déjà pour cet utilisateur
        const existing = await prisma.planche.findFirst({
          where: { id: item.id, userId },
        })

        if (existing) {
          await prisma.planche.update({
            where: { id: item.id },
            data: {
              rotationId: item.rotationId,
              ilot: item.ilot,
              surface: item.surface,
              largeur: item.largeur,
              longueur: item.longueur,
              posX: item.posX,
              posY: item.posY,
              rotation2D: item.rotation2D,
              planchesInfluencees: item.planchesInfluencees,
              notes: item.notes,
            },
          })
        } else {
          await prisma.planche.create({
            data: {
              id: item.id,
              userId,
              rotationId: item.rotationId,
              ilot: item.ilot,
              surface: item.surface,
              largeur: item.largeur,
              longueur: item.longueur,
              posX: item.posX,
              posY: item.posY,
              rotation2D: item.rotation2D,
              planchesInfluencees: item.planchesInfluencees,
              notes: item.notes,
            },
          })
        }
        stats.planches++
      }
    }

    // 6. Cultures (données utilisateur)
    if (data.cultures?.length) {
      for (const item of data.cultures) {
        const especeExists = await prisma.espece.findUnique({ where: { id: item.especeId } })
        if (!especeExists) continue

        await prisma.culture.upsert({
          where: { id: item.id },
          update: {
            especeId: item.especeId,
            varieteId: item.varieteId,
            plancheId: item.plancheId,
            annee: item.annee,
            dateSemis: item.dateSemis ? new Date(item.dateSemis) : null,
            datePlantation: item.datePlantation ? new Date(item.datePlantation) : null,
            dateRecolte: item.dateRecolte ? new Date(item.dateRecolte) : null,
            semisFait: item.semisFait ?? false,
            plantationFaite: item.plantationFaite ?? false,
            recolteFaite: item.recolteFaite ?? false,
            terminee: item.terminee,
            quantite: item.quantite,
            nbRangs: item.nbRangs,
            longueur: item.longueur,
            notes: item.notes,
          },
          create: {
            id: item.id,
            userId,
            especeId: item.especeId,
            varieteId: item.varieteId,
            plancheId: item.plancheId,
            annee: item.annee,
            dateSemis: item.dateSemis ? new Date(item.dateSemis) : null,
            datePlantation: item.datePlantation ? new Date(item.datePlantation) : null,
            dateRecolte: item.dateRecolte ? new Date(item.dateRecolte) : null,
            semisFait: item.semisFait ?? false,
            plantationFaite: item.plantationFaite ?? false,
            recolteFaite: item.recolteFaite ?? false,
            terminee: item.terminee,
            quantite: item.quantite,
            nbRangs: item.nbRangs,
            longueur: item.longueur,
            notes: item.notes,
          },
        })
        stats.cultures++
      }
    }

    // 7. Récoltes (données utilisateur)
    if (data.recoltes?.length) {
      for (const item of data.recoltes) {
        const cultureExists = await prisma.culture.findUnique({
          where: { id: item.cultureId, userId },
        })
        const especeExists = await prisma.espece.findUnique({ where: { id: item.especeId } })
        if (!cultureExists || !especeExists) continue

        await prisma.recolte.upsert({
          where: { id: item.id },
          update: {
            especeId: item.especeId,
            cultureId: item.cultureId,
            date: new Date(item.date),
            quantite: item.quantite,
            notes: item.notes,
          },
          create: {
            id: item.id,
            userId,
            especeId: item.especeId,
            cultureId: item.cultureId,
            date: new Date(item.date),
            quantite: item.quantite,
            notes: item.notes,
          },
        })
        stats.recoltes++
      }
    }

    // 8. Fertilisations (données utilisateur)
    if (data.fertilisations?.length) {
      for (const item of data.fertilisations) {
        const plancheExists = await prisma.planche.findFirst({
          where: { id: item.plancheId, userId },
        })
        const fertilisantExists = await prisma.fertilisant.findUnique({ where: { id: item.fertilisantId } })
        if (!plancheExists || !fertilisantExists) continue

        await prisma.fertilisation.upsert({
          where: { id: item.id },
          update: {
            plancheId: item.plancheId,
            fertilisantId: item.fertilisantId,
            date: new Date(item.date),
            quantite: item.quantite,
            notes: item.notes,
          },
          create: {
            id: item.id,
            userId,
            plancheId: item.plancheId,
            fertilisantId: item.fertilisantId,
            date: new Date(item.date),
            quantite: item.quantite,
            notes: item.notes,
          },
        })
        stats.fertilisations++
      }
    }

    // 9. Objets jardin (données utilisateur)
    if (data.objetsJardin?.length) {
      for (const item of data.objetsJardin) {
        await prisma.objetJardin.upsert({
          where: { id: item.id },
          update: {
            nom: item.nom,
            type: item.type,
            largeur: item.largeur,
            longueur: item.longueur,
            posX: item.posX,
            posY: item.posY,
            rotation2D: item.rotation2D ?? 0,
            couleur: item.couleur,
            notes: item.notes,
          },
          create: {
            id: item.id,
            userId,
            nom: item.nom,
            type: item.type,
            largeur: item.largeur,
            longueur: item.longueur,
            posX: item.posX,
            posY: item.posY,
            rotation2D: item.rotation2D ?? 0,
            couleur: item.couleur,
            notes: item.notes,
          },
        })
        stats.objetsJardin++
      }
    }

    const totalImported = Object.values(stats).reduce((a, b) => a + b, 0)

    return NextResponse.json({
      success: true,
      message: `${totalImported} enregistrements importés`,
      stats,
    })
  } catch (error) {
    console.error('Erreur import:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur lors de l'import" },
      { status: 500 }
    )
  }
}
