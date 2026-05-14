/**
 * API Registre de Culture (Cahier de culture)
 * GET /api/tracabilite/registre-culture?annee=2026&cultureId=123
 * Compile le registre complet de chaque culture de l'annee
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
    const cultureIdParam = searchParams.get('cultureId')

    const userId = session!.user.id
    const startOfYear = new Date(annee, 0, 1)
    const endOfYear = new Date(annee, 11, 31, 23, 59, 59)

    // Filtres de base
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cultureWhere: any = {
      userId,
      OR: [
        { annee },
        { dateSemis: { gte: startOfYear, lte: endOfYear } },
        { datePlantation: { gte: startOfYear, lte: endOfYear } },
        { dateRecolte: { gte: startOfYear, lte: endOfYear } },
      ],
    }

    if (cultureIdParam) {
      cultureWhere.id = parseInt(cultureIdParam)
    }

    // Recuperer toutes les cultures de l'annee avec leurs relations
    const cultures = await prisma.culture.findMany({
      where: cultureWhere,
      include: {
        espece: { select: { id: true, familleId: true, type: true } },
        variete: { select: { id: true, bio: true } },
        itp: { select: { id: true, nbRangs: true, espacement: true } },
        planche: {
          select: {
            nom: true,
            surface: true,
            largeur: true,
            longueur: true,
            ilot: true,
            type: true,
          },
        },
        recoltes: {
          orderBy: { date: 'asc' },
          select: {
            id: true,
            date: true,
            quantite: true,
            statut: true,
            prixKg: true,
            prixTotal: true,
            notes: true,
          },
        },
      },
      orderBy: [{ especeId: 'asc' }, { dateSemis: 'asc' }],
    })

    // Pour chaque culture, compiler l'historique complet
    const registre = await Promise.all(
      cultures.map(async (culture) => {
        // Recuperer interventions liees a cette culture
        const interventions = await prisma.intervention.findMany({
          where: {
            userId,
            date: { gte: startOfYear, lte: endOfYear },
            OR: [
              { cultureId: culture.id },
              ...(culture.plancheId ? [{ plancheId: culture.plancheId }] : []),
            ],
          },
          orderBy: { date: 'asc' },
          select: {
            id: true,
            date: true,
            type: true,
            description: true,
            produitPhyto: true,
            numAMM: true,
            doseAppliquee: true,
            uniteDose: true,
            surfaceTraitee: true,
            dar: true,
            cibleTraitement: true,
            conditionsMeteo: true,
            intrantNom: true,
            intrantQuantite: true,
            intrantUnite: true,
            dureeMinutes: true,
            notes: true,
          },
        })

        // Recuperer fertilisations sur la planche
        let fertilisations: {
          id: number
          date: Date
          quantite: number
          notes: string | null
          fertilisant: { id: string; type: string | null; n: number | null; p: number | null; k: number | null }
        }[] = []
        if (culture.plancheId) {
          fertilisations = await prisma.fertilisation.findMany({
            where: {
              userId,
              plancheId: culture.plancheId,
              date: { gte: startOfYear, lte: endOfYear },
            },
            orderBy: { date: 'asc' },
            select: {
              id: true,
              date: true,
              quantite: true,
              notes: true,
              fertilisant: {
                select: { id: true, type: true, n: true, p: true, k: true },
              },
            },
          })
        }

        // Separer traitements phyto des autres interventions
        const traitementsPhyto = interventions.filter(
          (i) => i.type === 'traitement_phyto'
        )
        const autresInterventions = interventions.filter(
          (i) => i.type !== 'traitement_phyto'
        )

        // Construire la chronologie
        const chronologie: {
          date: string
          type: string
          description: string
          details?: Record<string, unknown>
        }[] = []

        // Semis
        if (culture.dateSemis) {
          chronologie.push({
            date: culture.dateSemis.toISOString(),
            type: 'semis',
            description: `Semis ${culture.semisFait ? '(réalisé)' : '(prévu)'}`,
            details: {
              quantite: culture.quantite,
              nbRangs: culture.nbRangs,
              longueur: culture.longueur,
            },
          })
        }

        // Plantation
        if (culture.datePlantation) {
          chronologie.push({
            date: culture.datePlantation.toISOString(),
            type: 'plantation',
            description: `Plantation ${culture.plantationFaite ? '(realisee)' : '(prevue)'}`,
            details: {
              espacement: culture.espacement,
              nbRangs: culture.nbRangs,
            },
          })
        }

        // Interventions
        autresInterventions.forEach((i) => {
          chronologie.push({
            date: i.date.toISOString(),
            type: i.type,
            description: i.description || i.type,
            details: {
              dureeMinutes: i.dureeMinutes,
              intrant: i.intrantNom
                ? `${i.intrantNom} (${i.intrantQuantite || ''} ${i.intrantUnite || ''})`
                : null,
              notes: i.notes,
            },
          })
        })

        // Fertilisations
        fertilisations.forEach((f) => {
          chronologie.push({
            date: f.date.toISOString(),
            type: 'fertilisation',
            description: `${f.fertilisant.id} - ${f.quantite} kg`,
            details: {
              fertilisant: f.fertilisant.id,
              type: f.fertilisant.type,
              quantite: f.quantite,
              npk: `${f.fertilisant.n || 0}-${f.fertilisant.p || 0}-${f.fertilisant.k || 0}`,
              notes: f.notes,
            },
          })
        })

        // Traitements phyto
        traitementsPhyto.forEach((t) => {
          chronologie.push({
            date: t.date.toISOString(),
            type: 'traitement_phyto',
            description: `${t.produitPhyto || 'Traitement'} - ${t.cibleTraitement || ''}`,
            details: {
              produit: t.produitPhyto,
              numAMM: t.numAMM,
              dose: t.doseAppliquee,
              uniteDose: t.uniteDose,
              surface: t.surfaceTraitee,
              dar: t.dar,
              cible: t.cibleTraitement,
              meteo: t.conditionsMeteo,
            },
          })
        })

        // Recoltes
        culture.recoltes.forEach((r) => {
          chronologie.push({
            date: r.date.toISOString(),
            type: 'recolte',
            description: `Recolte: ${r.quantite} kg`,
            details: {
              quantite: r.quantite,
              statut: r.statut,
              prixKg: r.prixKg,
              prixTotal: r.prixTotal,
              notes: r.notes,
            },
          })
        })

        // Trier la chronologie par date
        chronologie.sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        )

        // Total recolte
        const totalRecolte = culture.recoltes.reduce(
          (sum, r) => sum + r.quantite,
          0
        )

        return {
          id: culture.id,
          identification: {
            espece: culture.espece.id,
            famille: culture.espece.familleId,
            variete: culture.variete?.id || null,
            bio: culture.variete?.bio || false,
            planche: culture.planche?.nom || null,
            surface: culture.planche?.surface || null,
            ilot: culture.planche?.ilot || null,
            typePlanche: culture.planche?.type || null,
          },
          dates: {
            semis: culture.dateSemis?.toISOString() || null,
            plantation: culture.datePlantation?.toISOString() || null,
            premiereRecolte: culture.recoltes.length > 0 ? culture.recoltes[0].date.toISOString() : null,
            derniereRecolte: culture.recoltes.length > 0 ? culture.recoltes[culture.recoltes.length - 1].date.toISOString() : null,
          },
          avancement: {
            semisFait: culture.semisFait,
            plantationFaite: culture.plantationFaite,
            recolteFaite: culture.recolteFaite,
            terminee: culture.terminee,
          },
          quantites: {
            quantite: culture.quantite,
            nbRangs: culture.nbRangs,
            longueur: culture.longueur,
            espacement: culture.espacement,
          },
          recoltes: culture.recoltes.map((r) => ({
            id: r.id,
            date: r.date.toISOString(),
            quantite: r.quantite,
            statut: r.statut,
            prixKg: r.prixKg,
            prixTotal: r.prixTotal,
            notes: r.notes,
          })),
          totalRecolte,
          interventions: autresInterventions.map((i) => ({
            id: i.id,
            date: i.date.toISOString(),
            type: i.type,
            description: i.description,
            dureeMinutes: i.dureeMinutes,
            notes: i.notes,
          })),
          fertilisations: fertilisations.map((f) => ({
            id: f.id,
            date: f.date.toISOString(),
            fertilisant: f.fertilisant.id,
            type: f.fertilisant.type,
            quantite: f.quantite,
            npk: `${f.fertilisant.n || 0}-${f.fertilisant.p || 0}-${f.fertilisant.k || 0}`,
            notes: f.notes,
          })),
          traitementsPhyto: traitementsPhyto.map((t) => ({
            id: t.id,
            date: t.date.toISOString(),
            produit: t.produitPhyto,
            numAMM: t.numAMM,
            dose: t.doseAppliquee,
            uniteDose: t.uniteDose,
            surface: t.surfaceTraitee,
            dar: t.dar,
            cible: t.cibleTraitement,
            meteo: t.conditionsMeteo,
          })),
          chronologie,
          notes: culture.notes,
        }
      })
    )

    // Grouper par espece
    const parEspece: Record<string, typeof registre> = {}
    registre.forEach((entry) => {
      const esp = entry.identification.espece
      if (!parEspece[esp]) parEspece[esp] = []
      parEspece[esp].push(entry)
    })

    // Stats
    const totalRecoltes = registre.reduce((sum, c) => sum + c.totalRecolte, 0)
    const totalInterventions = registre.reduce(
      (sum, c) => sum + c.interventions.length + c.traitementsPhyto.length + c.fertilisations.length,
      0
    )

    return NextResponse.json({
      registre,
      parEspece,
      stats: {
        totalCultures: registre.length,
        nbEspeces: Object.keys(parEspece).length,
        totalRecoltes,
        totalInterventions,
        periodeDebut: registre.length > 0 && registre[0].chronologie.length > 0
          ? registre[0].chronologie[0].date
          : null,
        periodeFin: registre.length > 0
          ? registre[registre.length - 1].chronologie.length > 0
            ? registre[registre.length - 1].chronologie[registre[registre.length - 1].chronologie.length - 1].date
            : null
          : null,
      },
      meta: {
        annee,
        cultureId: cultureIdParam ? parseInt(cultureIdParam) : null,
        generatedAt: new Date().toISOString(),
        type: 'registre_culture',
      },
    })
  } catch (err) {
    console.error('GET /api/tracabilite/registre-culture error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la generation du registre de culture' },
      { status: 500 }
    )
  }
}
