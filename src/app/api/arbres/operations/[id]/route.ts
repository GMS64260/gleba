import { invalidateKpi } from '@/lib/kpi/cache'
import { verrouillerReglements } from '@/lib/comptabilite/verrou-reglements'
import { ErreurReglement } from '@/lib/comptabilite/monnaie'
/**
 * API Opération Arbre individuelle
 * GET - Détail d'une opération
 * PUT - Mise à jour
 * DELETE - Suppression
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"
import { contexteEstFige, contexteOperationTraitement } from "@/lib/tracabilite/contexte-registre"
import { lireDelaiEtNatureDeclares } from "@/lib/phyto/delai-avant-recolte"
import {
  journaliserRectificationPhyto,
  motifRectification,
  operationAuRegistre,
} from "@/lib/tracabilite/historique-phyto"
import { createDepenseFromOperationArbre, deleteAutoEntry } from "@/lib/auto-compta"

interface Params {
  params: Promise<{ id: string }>
}

// GET /api/arbres/operations/[id]
export async function GET(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const operationId = parseInt(id, 10)
    if (isNaN(operationId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 })
    }

    const operation = await prisma.operationArbre.findUnique({
      where: {
        id: operationId,
        userId: session!.user.id,
      },
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
    })

    if (!operation) {
      return NextResponse.json({ error: "Opération non trouvée" }, { status: 404 })
    }

    invalidateKpi(session!.user.id)
    return NextResponse.json(operation)
  } catch (err) {
    if (err instanceof ErreurReglement) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("GET /api/arbres/operations/[id] error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la récupération de l'opération" },
      { status: 500 }
    )
  }
}

// PUT /api/arbres/operations/[id]
export async function PUT(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const operationId = parseInt(id, 10)
    if (isNaN(operationId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 })
    }

    // Première lecture hors transaction : elle ne sert qu'à répondre 404 sans
    // prendre le verrou. Aucune décision ne s'appuie sur elle.
    const apercu = await prisma.operationArbre.findUnique({
      where: {
        id: operationId,
        userId: session!.user.id,
      },
      select: { id: true },
    })

    if (!apercu) {
      return NextResponse.json({ error: "Opération non trouvée" }, { status: 404 })
    }

    const body = await request.json()

    // Lot dar-cadre-legal-blocage : délai de l'étiquette et nature du produit
    // d'un traitement (clé absente = inchangée), lus par le contrôle du délai
    // avant récolte.
    const delai = lireDelaiEtNatureDeclares(body)
    if ("refus" in delai) {
      return NextResponse.json({ error: delai.refus, champ: delai.champ }, { status: 400 })
    }

    const operation = await prisma.$transaction(async (tx) => {
      await verrouillerReglements(tx, session!.user.id)
      // Relue SOUS le verrou (contre-revue CR-PHY-03, tour 2) : deux
      // réalisations concurrentes lisaient toutes deux la tâche encore
      // planifiée ; la seconde refigeait le contexte sur la fiche du moment et
      // ne journalisait rien. Le contexte et le journal se décident sur l'état
      // que cette transaction modifie réellement.
      const existing = await tx.operationArbre.findFirst({ where: { id: operationId, userId: session!.user.id } })
      if (!existing) return null
      // Traitement réalisé : contexte du registre figé quand il le DEVIENT
      // (tâche cochée, type changé en traitement), ou s'il ne l'a jamais été
      // (CR-PHY-03). Un traitement déjà figé le reste : renvoyer « fait », la
      // date ou le type avec une simple correction relisait la fiche actuelle
      // de l'arbre et réécrivait culture, localisation et conduite bio.
      const jamaisFige =
        !contexteEstFige(existing)
      const etaitTraitementRealise = existing.type === 'traitement' && existing.fait
      const contexte =
        jamaisFige || !etaitTraitementRealise
          ? await contexteOperationTraitement(tx, session!.user.id, {
              type: body.type ?? existing.type,
              fait: body.fait ?? existing.fait,
              arbreId: existing.arbreId,
              date: body.date ? new Date(body.date) : existing.date,
            })
          : null
      const operation = await tx.operationArbre.update({
      where: { id: operationId },
      data: {
        ...(contexte ?? {}),
        date: body.date ? new Date(body.date) : undefined,
        type: body.type,
        description: body.description,
        produit: body.produit,
        dar: delai.dar,
        natureProduit: delai.natureProduit,
        quantite: body.quantite,
        unite: body.unite,
        cout: body.cout !== undefined ? (body.cout != null ? parseFloat(body.cout) : null) : undefined,
        datePrevue: body.datePrevue !== undefined ? (body.datePrevue ? new Date(body.datePrevue) : null) : undefined,
        // Solde d'une fenêtre fermée sans réalisation, ou réouverture (null).
        // Valider une opération la déssolde : « fait » l'emporte sur « pas fait ».
        abandonneeLe:
          body.fait === true
            ? null
            : body.abandonneeLe !== undefined
              ? (body.abandonneeLe ? new Date(body.abandonneeLe) : null)
              : undefined,
        fait: body.fait,
        notes: body.notes,
        dureeMinutes: body.dureeMinutes !== undefined ? (body.dureeMinutes ? parseInt(body.dureeMinutes) : null) : undefined,
        nbPersonnes: body.nbPersonnes !== undefined ? (body.nbPersonnes ? parseInt(body.nbPersonnes) : null) : undefined,
        recurrence: body.recurrence !== undefined ? (body.recurrence || null) : undefined,
        saisonRecommandee: body.saisonRecommandee !== undefined ? (body.saisonRecommandee || null) : undefined,
        // DEV3 #6 — champs acceptés par le POST mais absents du PUT jusqu'ici
        tempsHeures: body.tempsHeures !== undefined ? (body.tempsHeures != null ? parseFloat(body.tempsHeures) : null) : undefined,
        temperatureC: body.temperatureC !== undefined ? (body.temperatureC != null ? parseFloat(body.temperatureC) : null) : undefined,
        ventKmh: body.ventKmh !== undefined ? (body.ventKmh != null ? parseFloat(body.ventKmh) : null) : undefined,
        hygrometriePct: body.hygrometriePct !== undefined ? (body.hygrometriePct != null ? parseInt(body.hygrometriePct) : null) : undefined,
        pluie24h: body.pluie24h !== undefined ? (body.pluie24h != null ? Boolean(body.pluie24h) : null) : undefined,
        pluie24hMm: body.pluie24hMm !== undefined ? (body.pluie24hMm != null ? parseFloat(body.pluie24hMm) : null) : undefined,
        materiel: Array.isArray(body.materiel) ? body.materiel : undefined,
      },
      include: {
        arbre: {
          select: {
            id: true,
            nom: true,
            type: true,
          },
        },
      },
    })

      // Arrêté du 24 décembre 2025, art. 3 : l'état d'avant d'un traitement
      // du registre reste retrouvable (revue de conformité du 2026-11-12, C3).
      if (operationAuRegistre(existing)) {
        await journaliserRectificationPhyto(tx, {
          userId: session!.user.id,
          source: "operation_arbre",
          sourceId: existing.id,
          action: "modification",
          avant: existing,
          apres: operation,
          motif: motifRectification(body.motif),
          auteurId: session!.user.id,
        })
      }
      await createDepenseFromOperationArbre(session!.user.id, {
        id: operation.id,
        type: operation.type,
        description: operation.description,
        cout: operation.cout,
        date: operation.date,
        fait: operation.fait,
      }, tx)
      return operation
    })

    if (!operation) {
      return NextResponse.json({ error: "Opération non trouvée" }, { status: 404 })
    }

    invalidateKpi(session!.user.id)
    return NextResponse.json(operation)
  } catch (err) {
    if (err instanceof ErreurReglement) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("PUT /api/arbres/operations/[id] error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour" },
      { status: 500 }
    )
  }
}

// DELETE /api/arbres/operations/[id]
export async function DELETE(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const operationId = parseInt(id, 10)
    if (isNaN(operationId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 })
    }

    const apercu = await prisma.operationArbre.findUnique({
      where: {
        id: operationId,
        userId: session!.user.id,
      },
      select: { id: true },
    })

    if (!apercu) {
      return NextResponse.json({ error: "Opération non trouvée" }, { status: 404 })
    }

    const supprimee = await prisma.$transaction(async (tx) => {
      await verrouillerReglements(tx, session!.user.id)
      // Relue sous le verrou, comme au PUT : une tâche lue planifiée puis
      // réalisée entre-temps est un traitement du registre, à journaliser.
      const existing = await tx.operationArbre.findFirst({ where: { id: operationId, userId: session!.user.id } })
      if (!existing) return false
      if (operationAuRegistre(existing)) {
        await journaliserRectificationPhyto(tx, {
          userId: session!.user.id,
          source: "operation_arbre",
          sourceId: existing.id,
          action: "suppression",
          avant: existing,
          motif: motifRectification(request.nextUrl.searchParams.get("motif")),
          auteurId: session!.user.id,
        })
      }
      await deleteAutoEntry('operation_arbre', operationId, 'depense', session!.user.id, tx)
      await tx.operationArbre.delete({ where: { id: operationId, userId: session!.user.id } })
      return true
    })

    if (!supprimee) {
      return NextResponse.json({ error: "Opération non trouvée" }, { status: 404 })
    }

    invalidateKpi(session!.user.id)
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof ErreurReglement) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("DELETE /api/arbres/operations/[id] error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la suppression" },
      { status: 500 }
    )
  }
}
