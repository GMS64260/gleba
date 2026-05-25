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
import { ensurePlaceholderVariete } from '@/lib/varietes'
import { invalidateKpi } from '@/lib/kpi'
import { checkRotationViolation } from '@/lib/rotation-check'

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
    const etat = searchParams.get('etat') // Planifiée, Semée, Plantée, En recolte, Terminée

    // Construction du where - FILTRE PAR USER
    const where: Prisma.CultureWhereInput = {
      userId: session!.user.id,
    }

    if (search) {
      where.OR = [
        { espece: { id: { contains: search, mode: 'insensitive' } } },
        { variete: { id: { contains: search, mode: 'insensitive' } } },
        { planche: { nom: { contains: search, mode: 'insensitive' } } },
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
          recoltes: {
            select: { quantite: true },
          },
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
      // Total récolté (kg)
      totalRecolte: culture.recoltes.reduce((sum, r) => sum + r.quantite, 0),
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

    // Vérifier que l'espece existe
    const espece = await prisma.espece.findUnique({
      where: { id: data.especeId },
    })

    if (!espece) {
      return NextResponse.json(
        { error: `L'espèce "${data.especeId}" n'existe pas` },
        { status: 400 }
      )
    }

    // PROMPT 12 — Détection de violation de rotation.
    // Le client envoie `confirmRotation: true` pour ignorer le warning et créer
    // quand même (la culture est alors flaggée rotation_violee=true).
    const confirmRotation = body.confirmRotation === true
    const rotationCheck = await checkRotationViolation(
      data.plancheId ?? null,
      data.especeId,
      data.annee ?? new Date().getFullYear()
    )
    if (rotationCheck && !confirmRotation) {
      return NextResponse.json(
        {
          warning: rotationCheck.message,
          rotationViolation: rotationCheck,
        },
        { status: 409 }
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

    // Audit Marc 2026-05-14 — Bug 04 : remonter les warnings dates/ITP
    // au client (non bloquant). Le client peut alors afficher un toast
    // explicite "Semis le 01/06 hors fenêtre ITP recommandée (mars–avril)".
    const dateWarnings: string[] = []
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

        if (!dateValidation.valid) {
          console.error('⚠️ Date validation errors (NOT BLOCKING):', dateValidation.errors)
        }
        dateWarnings.push(...dateValidation.warnings)
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
              id: true,
              espece: { select: { id: true } },
              dateSemis: true,
              datePlantation: true,
              dateRecolte: true,
              nbRangs: true,
              itp: {
                select: { espacementRangs: true },
              },
            },
          },
        },
      })

      // BUG #12 (audit Marc 2026-05-15) : détection chevauchement de
      // dates sur la même planche. Avant : Tomate (01/03–10/07) et
      // Concombre (25/05–25/07) pouvaient cohabiter sur A1 sans aucune
      // alerte. Désormais on remonte un warning non-bloquant qui
      // s'affiche en toast comme les warnings ITP.
      if (planche && data.plancheId) {
        const newStart =
          data.dateSemis ? new Date(data.dateSemis) :
          data.datePlantation ? new Date(data.datePlantation) : null
        const newEnd = data.dateRecolte ? new Date(data.dateRecolte) : null
        if (newStart && newEnd) {
          for (const c of planche.cultures) {
            const cStart = c.dateSemis ?? c.datePlantation
            const cEnd = c.dateRecolte
            if (!cStart || !cEnd) continue
            const overlap = newStart < new Date(cEnd) && new Date(cStart) < newEnd
            if (overlap) {
              const fmt = (d: Date | string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
              dateWarnings.push(
                `Chevauchement détecté sur la planche : ${c.espece?.id || 'culture'} #${c.id} (${fmt(cStart)}–${fmt(cEnd)}) recouvre la période demandée.`
              )
            }
          }
        }
      }

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

    // Auto-remplir aIrriguer si non fourni et espece a besoin eau élevé
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

    // Création + décrément stock dans une transaction atomique
    const culture = await prisma.$transaction(async (tx) => {
      // Si pas de variété fournie : assigner le placeholder "Non spécifiée"
      // de l'espèce (créé à la demande). Aucune Culture ne reste sans variete.
      const varieteId = data.varieteId ?? (await ensurePlaceholderVariete(data.especeId, tx))

      // Feedback Marc 2026-05-16 — V4 Bug 6 : si aucun ITP n'est fourni
      // explicitement, on choisit automatiquement le premier ITP de
      // l'espèce (préférence "-printemps", puis "-plein-champ"). Sans
      // cela, les écrans Planification (Cultures prévues, Récoltes par
      // mois, Plants nécessaires…) traitaient toutes les cultures
      // comme orphelines et n'arrivaient pas à dériver les dates/durées.
      if (!data.itpId) {
        const autoItp = await tx.iTP.findFirst({
          where: { especeId: data.especeId },
          orderBy: { id: "asc" },
          select: { id: true },
        })
        if (autoItp) {
          data.itpId = autoItp.id
        }
      }

      // Création avec userId. rotationViolee=true si l'utilisateur a confirmé
      // malgré le warning (PROMPT 12).
      const newCulture = await tx.culture.create({
        data: {
          ...data,
          varieteId,
          userId: session!.user.id,
          aIrriguer,
          rotationViolee: rotationCheck !== null,
        },
        include: {
          espece: true,
          variete: true,
          itp: true,
          planche: true,
        },
      })

      // Décrément automatique du stock de semences (per-user)
      if (data.varieteId && data.dateSemis && itp) {
        const variete = await tx.variete.findUnique({
          where: { id: data.varieteId },
          select: { nbGrainesG: true },
        })

        const userStock = await tx.userStockVariete.findFirst({
          where: { userId: session!.user.id, varieteId: data.varieteId },
        })

        if (variete && userStock && userStock.stockGraines && userStock.stockGraines > 0 && variete.nbGrainesG) {
          const planche = newCulture.planche
          const longueur = data.longueur || 0
          const nbRangs = data.nbRangs || 1
          const espacement = data.espacement || 0

          let grammesNecessaires = 0

          if (espacement > 0 && variete.nbGrainesG > 0) {
            const nbGrainesPlant = itp.nbGrainesPlant || 1
            grammesNecessaires = Math.ceil(
              (longueur * nbRangs / espacement * 100 * nbGrainesPlant) /
              variete.nbGrainesG
            )
          } else if (itp.doseSemis && planche?.largeur) {
            grammesNecessaires = Math.ceil(
              longueur * planche.largeur * itp.doseSemis
            )
          }

          if (grammesNecessaires > 0) {
            await tx.userStockVariete.upsert({
              where: { userId_varieteId: { userId: session!.user.id, varieteId: data.varieteId } },
              create: {
                userId: session!.user.id,
                varieteId: data.varieteId,
                stockGraines: 0,
                dateStock: new Date(),
              },
              update: {
                stockGraines: Math.max(0, userStock.stockGraines - grammesNecessaires),
                dateStock: new Date(),
              },
            })
          }
        }
      }

      return newCulture
    })

    invalidateKpi(session!.user.id)
    // Audit Marc 2026-05-14 — Bug 04 : warnings remontés non bloquants
    return NextResponse.json(
      dateWarnings.length > 0 ? { ...culture, warnings: dateWarnings } : culture,
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/cultures error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création de la culture' },
      { status: 500 }
    )
  }
}
