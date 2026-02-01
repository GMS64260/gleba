/**
 * API Routes pour les Cultures
 * GET /api/cultures - Liste des cultures (avec filtres, pagination, tri)
 * POST /api/cultures - Créer une culture
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createCultureSchema, validateCultureDates } from '@/lib/validations'
import { Prisma } from '@prisma/client'
import { requireAuthApi } from '@/lib/auth-utils'
import { peutAjouterCulture, suggererAjustements } from '@/lib/planche-validation'

// GET /api/cultures
export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)

    // Pagination
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')
    const skip = (page - 1) * pageSize

    // Tri
    const sortBy = searchParams.get('sortBy') || 'id'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Filtres
    const search = searchParams.get('search') || ''
    const annee = searchParams.get('annee')
    const especeId = searchParams.get('especeId')
    const plancheId = searchParams.get('plancheId')
    const etat = searchParams.get('etat') // Planifiée, Semée, Plantée, En récolte, Terminée

    // Construction du where - FILTRE PAR USER
    const where: Prisma.CultureWhereInput = {
      userId: session!.user.id,
    }

    if (search) {
      where.OR = [
        { espece: { id: { contains: search, mode: 'insensitive' } } },
        { variete: { id: { contains: search, mode: 'insensitive' } } },
        { planche: { id: { contains: search, mode: 'insensitive' } } },
        { notes: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (annee) {
      where.annee = parseInt(annee)
    }

    if (especeId) {
      where.especeId = especeId
    }

    if (plancheId) {
      where.plancheId = plancheId
    }

    // Filtre par état (calculé)
    if (etat) {
      switch (etat) {
        case 'Planifiée':
          where.semisFait = false
          where.terminee = null
          break
        case 'Semée':
          where.semisFait = true
          where.plantationFaite = false
          where.terminee = null
          break
        case 'Plantée':
          where.plantationFaite = true
          where.recolteFaite = false
          where.terminee = null
          break
        case 'En récolte':
          where.recolteFaite = true
          where.terminee = null
          break
        case 'Terminée':
          where.terminee = { not: null }
          break
      }
    }

    // Requête avec comptage
    const [cultures, total] = await Promise.all([
      prisma.culture.findMany({
        where,
        include: {
          espece: {
            include: { famille: true },
          },
          variete: true,
          itp: true,
          planche: true,
          _count: {
            select: { recoltes: true },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: pageSize,
      }),
      prisma.culture.count({ where }),
    ])

    // Ajouter les champs calculés
    const culturesWithComputed = cultures.map((culture) => ({
      ...culture,
      // Calcul de l'état
      etat: culture.terminee
        ? 'Terminée'
        : culture.recolteFaite
          ? 'En récolte'
          : culture.plantationFaite
            ? 'Plantée'
            : culture.semisFait
              ? 'Semée'
              : 'Planifiée',
      // Calcul du type
      type: culture.espece?.vivace
        ? 'Vivace'
        : culture.dateSemis && culture.datePlantation && culture.dateRecolte
          ? 'Semis pépinière'
          : culture.dateSemis && culture.dateRecolte
            ? 'Semis en place'
            : culture.datePlantation && culture.dateRecolte
              ? 'Plant'
              : 'Non défini',
    }))

    return NextResponse.json({
      data: culturesWithComputed,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error('GET /api/cultures error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des cultures' },
      { status: 500 }
    )
  }
}

// POST /api/cultures
export async function POST(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()
    console.log('🔵 POST /api/cultures - body:', JSON.stringify(body, null, 2))

    // Validation
    const validationResult = createCultureSchema.safeParse(body)
    if (!validationResult.success) {
      console.error('❌ Zod validation failed:', validationResult.error.flatten())
      return NextResponse.json(
        { error: 'Données invalides', details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    const data = validationResult.data
    console.log('✅ Zod validation passed')

    // Vérifier que l'espèce existe
    const espece = await prisma.espece.findUnique({
      where: { id: data.especeId },
    })

    if (!espece) {
      return NextResponse.json(
        { error: `L'espèce "${data.especeId}" n'existe pas` },
        { status: 400 }
      )
    }

    // Récupérer l'ITP si fourni (pour validation dates et calcul stock)
    let itp = null
    if (data.itpId) {
      itp = await prisma.iTP.findUnique({
        where: { id: data.itpId },
        select: {
          semaineSemis: true,
          semainePlantation: true,
          semaineRecolte: true,
          espacementRangs: true,
          nbGrainesPlant: true,
          doseSemis: true,
        },
      })
    }

    // Validation des dates (seulement si au moins une date fournie)
    // TEMPORAIREMENT EN MODE WARNING SEULEMENT pour debugging
    if (data.dateSemis || data.datePlantation || data.dateRecolte) {
      try {
        const annee = data.annee || new Date().getFullYear()
        const dateValidation = validateCultureDates({
          dateSemis: data.dateSemis,
          datePlantation: data.datePlantation,
          dateRecolte: data.dateRecolte,
          itp,
          annee,
        })

        // Log mais ne bloque PAS pour le moment
        if (!dateValidation.valid) {
          console.error('⚠️ Date validation errors (NOT BLOCKING):', dateValidation.errors)
        }
        if (dateValidation.warnings.length > 0) {
          console.warn('Date warnings:', dateValidation.warnings)
        }
      } catch (validationError) {
        console.error('Erreur validation dates:', validationError)
      }
    }

    // Valider l'occupation de la planche si plancheId fourni
    if (data.plancheId) {
      const planche = await prisma.planche.findFirst({
        where: {
          id: data.plancheId,
          userId: session!.user.id,
        },
        include: {
          cultures: {
            where: { terminee: null },
            select: {
              nbRangs: true,
              itp: {
                select: { espacementRangs: true },
              },
            },
          },
        },
      })

      if (planche) {
        // Récupérer l'ITP pour avoir l'espacementRangs
        let espacementRangs = 30 // Défaut 30cm
        if (data.itpId) {
          const itp = await prisma.iTP.findUnique({
            where: { id: data.itpId },
            select: { espacementRangs: true },
          })
          espacementRangs = itp?.espacementRangs || 30
        }

        // Cultures existantes avec leur espacement
        const culturesExistantes = planche.cultures.map(c => ({
          nbRangs: c.nbRangs || 1,
          espacementRangs: c.itp?.espacementRangs || 30,
        }))

        // Nouvelle culture
        const nouvelleCulture = {
          nbRangs: data.nbRangs || 1,
          espacementRangs,
          longueur: data.longueur || undefined,
        }

        const validation = peutAjouterCulture(
          { largeur: planche.largeur || 0.8, longueur: planche.longueur || 2 },
          culturesExistantes,
          nouvelleCulture
        )

        if (!validation.possible) {
          const suggestions = suggererAjustements(
            { largeur: planche.largeur || 0.8, longueur: planche.longueur || 2 },
            culturesExistantes,
            nouvelleCulture
          )

          return NextResponse.json(
            {
              error: validation.message,
              suggestions: suggestions.map(s => s.message),
              details: {
                largeurPlanche: planche.largeur,
                largeurOccupee: validation.largeurOccupee,
                largeurDisponible: validation.largeurDisponible,
                largeurNecessaire: validation.largeurNecessaire,
              },
            },
            { status: 400 }
          )
        }
      }
    }

    // Auto-remplir aIrriguer si non fourni et espèce a besoin eau élevé
    let aIrriguer = data.aIrriguer
    if (aIrriguer === undefined || aIrriguer === null) {
      // Besoin eau >= 3 ou irrigation explicitement "Eleve"/"Élevé"
      if (
        (espece.besoinEau && espece.besoinEau >= 3) ||
        espece.irrigation?.toLowerCase() === 'eleve' ||
        espece.irrigation?.toLowerCase() === 'élevé'
      ) {
        aIrriguer = true
      }
    }

    // Vérifier que les foreign keys existent avant création
    if (data.itpId) {
      const itpExists = await prisma.iTP.findUnique({ where: { id: data.itpId } })
      if (!itpExists) {
        console.error(`❌ ITP not found: ${data.itpId}`)
        return NextResponse.json(
          { error: `ITP "${data.itpId}" introuvable dans la base` },
          { status: 400 }
        )
      }
    }

    if (data.plancheId) {
      const plancheExists = await prisma.planche.findUnique({
        where: { id: data.plancheId, userId: session!.user.id }
      })
      if (!plancheExists) {
        // Debug: vérifier si planche existe pour un autre user
        const plancheAnyUser = await prisma.planche.findUnique({
          where: { id: data.plancheId }
        })
        console.error(`❌ Planche not found for user: ${data.plancheId}`)
        console.error(`   Exists for another user?: ${!!plancheAnyUser}`)
        console.error(`   Current userId: ${session!.user.id}`)
        return NextResponse.json(
          { error: `Planche "${data.plancheId}" introuvable pour votre compte` },
          { status: 400 }
        )
      }
    }

    // Création avec userId
    console.log('✅ Creating culture with data:', { ...data, userId: session!.user.id, aIrriguer })
    const culture = await prisma.culture.create({
      data: {
        ...data,
        userId: session!.user.id,
        aIrriguer,
      },
      include: {
        espece: true,
        variete: true,
        itp: true,
        planche: true,
      },
    })
    console.log('✅ Culture created:', culture.id)

    // Décrément automatique du stock de semences
    if (data.varieteId && data.dateSemis && itp) {
      try {
        const variete = await prisma.variete.findUnique({
          where: { id: data.varieteId },
          select: { nbGrainesG: true, stockGraines: true },
        })

        if (variete && variete.stockGraines && variete.stockGraines > 0 && variete.nbGrainesG) {
          const planche = culture.planche
          const longueur = data.longueur || 0
          const nbRangs = data.nbRangs || 1
          const espacement = data.espacement || 0

          // Formule potaleger (plus précise)
          let grammesNecessaires = 0

          if (espacement > 0 && variete.nbGrainesG > 0) {
            // Semis en ligne avec espacement
            const nbGrainesPlant = itp.nbGrainesPlant || 1
            grammesNecessaires = Math.ceil(
              (longueur * nbRangs / espacement * 100 * nbGrainesPlant) /
              variete.nbGrainesG
            )
          } else if (itp.doseSemis && planche?.largeur) {
            // Semis à la volée (dose au m²)
            grammesNecessaires = Math.ceil(
              longueur * planche.largeur * itp.doseSemis
            )
          }

          if (grammesNecessaires > 0) {
            await prisma.variete.update({
              where: { id: data.varieteId },
              data: {
                stockGraines: Math.max(0, variete.stockGraines - grammesNecessaires),
                dateStock: new Date(),
              },
            })
          }
        }
      } catch (stockError) {
        console.warn('Erreur décrément stock semences:', stockError)
        // Ne pas bloquer la création de culture si erreur stock
      }
    }

    return NextResponse.json(culture, { status: 201 })
  } catch (error) {
    console.error('POST /api/cultures error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création de la culture' },
      { status: 500 }
    )
  }
}
