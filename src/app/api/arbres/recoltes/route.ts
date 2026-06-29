/**
 * API Récoltes Arbres (avec gestion statut stock/vente)
 * GET /api/arbres/recoltes - Liste des recoltes avec filtre statut
 * POST /api/arbres/recoltes - Créer une recolte (statut en_stock par défaut)
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"
import { snapshotStatutBio } from "@/lib/statut-bio"
import { genererNumeroLot } from "@/lib/recolte/lot"

// GET /api/arbres/recoltes
export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = session!.user.id
    const searchParams = request.nextUrl.searchParams

    // Filtres
    const arbreId = searchParams.get("arbreId")
    const year = searchParams.get("year")
    const statut = searchParams.get("statut")

    const where: Record<string, unknown> = { userId }

    if (arbreId) {
      where.arbreId = parseInt(arbreId)
    }

    if (year) {
      const yearNum = parseInt(year)
      where.date = {
        gte: new Date(yearNum, 0, 1),
        lt: new Date(yearNum + 1, 0, 1),
      }
    }

    if (statut) {
      where.statut = statut
    }

    const recoltes = await prisma.recolteArbre.findMany({
      where,
      include: {
        arbre: {
          select: {
            id: true,
            nom: true,
            type: true,
            espece: true,
          },
        },
      },
      orderBy: { date: "desc" },
    })

    return NextResponse.json(recoltes)
  } catch (err) {
    console.error("GET /api/arbres/recoltes error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la récupération des récoltes" },
      { status: 500 }
    )
  }
}

// POST /api/arbres/recoltes
export async function POST(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = session!.user.id
    const body = await request.json()

    // Validation
    if (!body.arbreId) {
      return NextResponse.json(
        { error: "L'arbre est requis" },
        { status: 400 }
      )
    }

    if (typeof body.quantite !== "number" || !isFinite(body.quantite) || body.quantite < 0) {
      return NextResponse.json(
        { error: "La quantité doit être positive" },
        { status: 400 }
      )
    }

    // Vérifier que l'arbre appartient à l'utilisateur.
    // PROMPT 12 — on charge la zone et la parcelle pour snapshoter le statut Bio.
    // DEV3 #4 — on charge aussi parcelleGeo.nom pour le N° de lot.
    // Feedback Marc 2026-05-16 — Bug 08 : on charge aussi variete +
    // espece pour valider la cohérence saison de récolte.
    const arbre = await prisma.arbre.findFirst({
      where: { id: body.arbreId, userId },
      include: {
        zone: { select: { statutBio: true, dateDebutConversion: true } },
        parcelleGeo: { select: { id: true, nom: true, statutBio: true, dateDebutConversion: true } },
      },
    })

    // Feedback Marc 2026-05-16 — Bug 08 : alerte si la date de récolte
    // est hors saison agronomique de la variété (ex: Pommier Golden
    // récolté en mai alors que la récolte standard est semaine 38-42).
    const recolteWarnings: string[] = []
    if (arbre) {
      const dateRecolteForCheck = body.date ? new Date(body.date) : new Date()
      const varieteAvecRecolte = arbre.variete
        ? await prisma.variete.findFirst({
            where: { id: arbre.variete, especeId: arbre.espece ?? undefined },
            select: { id: true, semaineRecolte: true, dureeRecolte: true },
          })
        : null
      if (varieteAvecRecolte?.semaineRecolte) {
        const start = new Date(dateRecolteForCheck.getFullYear(), 0, 1)
        const diffJours = (dateRecolteForCheck.getTime() - start.getTime()) / 86_400_000
        const semaineSaisie = Math.min(53, Math.max(1, Math.ceil((diffJours + start.getDay() + 1) / 7)))
        const semaineDebut = varieteAvecRecolte.semaineRecolte
        const semaineFin = semaineDebut + (varieteAvecRecolte.dureeRecolte ?? 4)
        const toleranceSemaines = 3
        // Fenêtre à cheval sur deux années (semaineFin > 53) : elle couvre
        // [semaineDebut..53] ∪ [1..semaineFin-53]. La semaine saisie étant
        // toujours ≤ 53, on teste l'appartenance aux deux segments.
        const horsSaison =
          semaineFin > 53
            ? semaineSaisie < semaineDebut - toleranceSemaines &&
              semaineSaisie > semaineFin - 53 + toleranceSemaines
            : semaineSaisie < semaineDebut - toleranceSemaines ||
              semaineSaisie > semaineFin + toleranceSemaines
        if (horsSaison) {
          recolteWarnings.push(
            `Hors saison : ${arbre.espece ?? "espèce"} ${arbre.variete} se récolte normalement semaines ${semaineDebut}-${semaineFin} (saisie semaine ${semaineSaisie}).`
          )
        }
      }
    }

    if (!arbre) {
      return NextResponse.json(
        { error: "Arbre non trouvé" },
        { status: 404 }
      )
    }

    // Statut Bio : priorité à la zone verger, sinon parcelle géo.
    const sourceBio = arbre.zone ?? arbre.parcelleGeo
    const dateRecolte = body.date ? new Date(body.date) : new Date()
    // DEV3 #4 — statut Bio surchargeable depuis le formulaire (auto-rempli
    // depuis la parcelle d'origine par défaut).
    const statutBioSnapshot =
      body.statutBioSnapshot ||
      (sourceBio
        ? snapshotStatutBio(sourceBio.statutBio, sourceBio.dateDebutConversion, dateRecolte)
        : null)

    // DEV3 #4 — parcelle d'origine : par défaut celle de l'arbre, surchargeable.
    // Bug traçabilité AB : le front envoyait `parcelleId: null` (champ absent du
    // formulaire), ce qui court-circuitait le défaut et produisait des lots "-NA-".
    // On prend donc le défaut quand la valeur est null OU undefined.
    const parcelleId = body.parcelleId ?? arbre.parcelleGeo?.id ?? null

    // DEV3 #4 — Numéro de lot auto YYYYMMDD-PARCELLE-ESPECE-NN si non fourni.
    // Pour le séquentiel NN, on compte le nb de lots du jour + même parcelle + même espèce.
    let numLot = body.numLot || null
    if (!numLot) {
      const parcelleNom = parcelleId
        ? (await prisma.parcelleGeo.findUnique({ where: { id: parcelleId }, select: { nom: true } }))?.nom
        : null
      const dayStart = new Date(dateRecolte)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(dateRecolte)
      dayEnd.setHours(23, 59, 59, 999)
      const sameDayCount = await prisma.recolteArbre.count({
        where: {
          userId,
          date: { gte: dayStart, lte: dayEnd },
          ...(parcelleId ? { parcelleId } : {}),
          arbre: { espece: arbre.espece },
        },
      })
      numLot = genererNumeroLot({
        date: dateRecolte,
        parcelleNom: parcelleNom ?? null,
        espece: arbre.espece,
        numeroSequence: sameDayCount + 1,
      })
    }

    // Feedback testeur cmpky7zmy — Si récolte hors saison, on persiste
    // l'avertissement dans le champ notes pour qu'il reste visible sur
    // la fiche/liste, et pas seulement dans le toast éphémère lors de
    // la création (le testeur n'avait aucun indice visuel a posteriori
    // qu'une Belle de Boskoop avait été récoltée 5 mois trop tôt).
    const notesAvecWarning = recolteWarnings.length > 0
      ? `⚠️ ${recolteWarnings.join(' ')}${body.notes ? `\n${body.notes}` : ''}`
      : body.notes || null

    const recolte = await prisma.recolteArbre.create({
      data: {
        userId,
        arbreId: body.arbreId,
        date: dateRecolte,
        quantite: body.quantite,
        qualite: body.qualite || null,
        prixKg: body.prixKg || null,
        statut: "en_stock",
        datePeremption: body.datePeremption ? new Date(body.datePeremption) : null,
        notes: notesAvecWarning,
        statutBioSnapshot,
        // DEV3 #4
        parcelleId,
        numLot,
        categorieCommerciale: body.categorieCommerciale || null,
        destinationCommerce: body.destinationCommerce || null,
        conditionnement: body.conditionnement || null,
      },
      include: {
        arbre: {
          select: {
            id: true,
            nom: true,
            type: true,
          },
        },
        parcelle: { select: { id: true, nom: true } },
      },
    })

    return NextResponse.json(
      recolteWarnings.length > 0 ? { ...recolte, warnings: recolteWarnings } : recolte,
      { status: 201 }
    )
  } catch (err) {
    console.error("POST /api/arbres/recoltes error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la création de la récolte" },
      { status: 500 }
    )
  }
}
