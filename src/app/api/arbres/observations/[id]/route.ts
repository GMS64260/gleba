/**
 * API Routes pour une Observation de santé spécifique
 * PUT /api/arbres/observations/:id - Modifier (toggle résolu, etc.)
 * DELETE /api/arbres/observations/:id - Supprimer
 */
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"
import { MESSAGE_AMM_INVALIDE, numAMMValide } from "@/lib/tracabilite/amm"
import { resoudreOperateurExploitation } from "@/lib/tracabilite/operateur-exploitation"
import {
  MESSAGE_CHAMPS_REGLEMENTAIRES,
  champsManquantsObservationPhyto,
  type ObservationPhyto,
} from "@/lib/tracabilite/conformite-observation-phyto"
import { chargerContexteRegistre } from "@/lib/tracabilite/contexte-registre"
import {
  journaliserRectificationPhyto,
  motifRectification,
  observationAuRegistre,
} from "@/lib/tracabilite/historique-phyto"

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const obsId = parseInt(id)
    if (isNaN(obsId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 })
    }
    const body = await request.json()

    const existing = await prisma.observationSante.findFirst({
      where: { id: obsId, userId: session!.user.id },
    })
    if (!existing) {
      return NextResponse.json({ error: "Observation non trouvée" }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    // Le dialog d'édition envoie aussi date et arbreId : sans ces deux blocs,
    // leurs modifications étaient silencieusement perdues.
    if (body.date) data.date = new Date(body.date)
    if (body.arbreId !== undefined && body.arbreId) {
      const newArbreId = parseInt(body.arbreId)
      if (isNaN(newArbreId)) {
        return NextResponse.json({ error: "Arbre invalide" }, { status: 400 })
      }
      const arbre = await prisma.arbre.findFirst({
        where: { id: newArbreId, userId: session!.user.id },
      })
      if (!arbre) {
        return NextResponse.json({ error: "Arbre non trouvé" }, { status: 404 })
      }
      data.arbreId = newArbreId
    }
    if (body.type !== undefined) data.type = body.type
    if (body.symptome !== undefined) data.symptome = body.symptome
    if (body.diagnostic !== undefined) data.diagnostic = body.diagnostic
    if (body.gravite !== undefined) data.gravite = body.gravite
    if (body.organe !== undefined) data.organe = body.organe
    if (body.traitement !== undefined) data.traitement = body.traitement
    if (body.methodeTraitement !== undefined) data.methodeTraitement = body.methodeTraitement
    if (body.produit !== undefined) data.produit = body.produit
    if (body.doseAppliquee !== undefined) data.doseAppliquee = body.doseAppliquee === "" || body.doseAppliquee == null ? null : parseFloat(body.doseAppliquee)
    if (body.uniteDose !== undefined) data.uniteDose = body.uniteDose
    if (body.dar !== undefined) data.dar = body.dar === "" || body.dar == null ? null : parseInt(body.dar)
    if (body.numAMM !== undefined) data.numAMM = body.numAMM
    if (body.notes !== undefined) data.notes = body.notes
    // PROMPT 11 LOT D — PBI
    if (body.stadeBBCH !== undefined) data.stadeBBCH = body.stadeBBCH || null
    if (body.pctOrganesTouches !== undefined) data.pctOrganesTouches = body.pctOrganesTouches == null ? null : parseInt(body.pctOrganesTouches)
    if (body.photoUrl !== undefined) data.photoUrl = body.photoUrl || null
    // DEV3 #1 — Champs réglementaires (arrêté du 4 mai 2017 modifié)
    if (body.surfaceTraiteeHa !== undefined) data.surfaceTraiteeHa = body.surfaceTraiteeHa == null ? null : parseFloat(body.surfaceTraiteeHa)
    if (body.volumeBouillieLHa !== undefined) data.volumeBouillieLHa = body.volumeBouillieLHa == null ? null : parseFloat(body.volumeBouillieLHa)
    if (body.volumeBouillieLTotal !== undefined) data.volumeBouillieLTotal = body.volumeBouillieLTotal == null ? null : parseFloat(body.volumeBouillieLTotal)
    if (body.temperatureC !== undefined) data.temperatureC = body.temperatureC == null ? null : parseFloat(body.temperatureC)
    if (body.ventKmh !== undefined) data.ventKmh = body.ventKmh == null ? null : parseFloat(body.ventKmh)
    if (body.hygrometriePct !== undefined) data.hygrometriePct = body.hygrometriePct == null ? null : parseInt(body.hygrometriePct)
    if (body.pluie24h !== undefined) data.pluie24h = body.pluie24h == null ? null : Boolean(body.pluie24h)
    if (body.pluie24hMm !== undefined) data.pluie24hMm = body.pluie24hMm == null ? null : parseFloat(body.pluie24hMm)
    if (body.epiPortes !== undefined) data.epiPortes = Array.isArray(body.epiPortes) ? body.epiPortes : []
    if (body.zntRespectee !== undefined) data.zntRespectee = body.zntRespectee == null ? null : Boolean(body.zntRespectee)
    if (body.zntDistanceM !== undefined) data.zntDistanceM = body.zntDistanceM == null ? null : parseInt(body.zntDistanceM)
    if (body.parcelleId !== undefined) {
      // Clé étrangère revalidée en appartenance (son nom sort au registre phyto).
      const parcelleId = body.parcelleId ? String(body.parcelleId) : null
      if (parcelleId) {
        const parcelle = await prisma.parcelleGeo.findFirst({
          where: { id: parcelleId, userId: session!.user.id },
          select: { id: true },
        })
        if (!parcelle) {
          return NextResponse.json({ error: "Données invalides — parcelleId : parcelle non trouvée." }, { status: 400 })
        }
      }
      data.parcelleId = parcelleId
    }
    if (body.operateurId !== undefined) {
      // Revue cmvgeltj1 — titulaire ou membre de l'exploitation seulement
      // (l'opérateur sort en Applicateur au registre), sinon refus nommé.
      const operateur = await resoudreOperateurExploitation(session!.user.id, body.operateurId)
      if ("refus" in operateur) {
        return NextResponse.json({ error: operateur.refus }, { status: 400 })
      }
      data.operateurId = operateur.operateurId
    }
    if (body.certiphytoNum !== undefined) data.certiphytoNum = body.certiphytoNum || null
    if (body.resolu !== undefined) {
      data.resolu = body.resolu
      if (body.resolu && !existing.dateResolution) {
        data.dateResolution = new Date()
      }
      if (!body.resolu) {
        data.dateResolution = null
      }
    }

    // QA cmv2962ey — même règle de forme que les interventions : sept chiffres ou vide.
    if (data.numAMM && !numAMMValide(String(data.numAMM))) {
      return NextResponse.json({ error: MESSAGE_AMM_INVALIDE }, { status: 400 })
    }
    // DEV3 audit fix, revue cmvgeltj1 (2026-10-20) — une modification ne vide
    // pas un champ réglementaire (même liste que la saisie et le registre),
    // et passer une ligne en méthode chimique exige ses champs. Un champ déjà
    // manquant ne bloque pas : la ligne non conforme reste corrigeable champ
    // par champ depuis le dialogue d'édition du registre Verger.
    const manquantsAvant = new Set(
      champsManquantsObservationPhyto(existing).map((champ) => champ.cle),
    )
    const apres: ObservationPhyto = Object.assign({}, existing, data)
    const manquants = champsManquantsObservationPhyto(apres)
      .filter((champ) => !manquantsAvant.has(champ.cle))
      .map((champ) => champ.libelle)
    if (manquants.length > 0) {
      return NextResponse.json(
        { error: MESSAGE_CHAMPS_REGLEMENTAIRES + manquants.join(", "), manquants },
        { status: 400 },
      )
    }

    const observation = await prisma.$transaction(async (tx) => {
      // Contexte du registre figé à nouveau si l'arbre, la parcelle ou la date
      // change, ou s'il ne l'a jamais été (revue de conformité du 2026-11-12, C4).
      const apresFusion = { ...existing, ...data } as typeof existing
      const jamaisFige =
        existing.cultureRegistre == null && existing.localisationRegistre == null && existing.conduiteBio == null
      if (observationAuRegistre(apresFusion) && (jamaisFige || "arbreId" in data || "parcelleId" in data || "date" in data)) {
        Object.assign(
          data,
          await chargerContexteRegistre(
            tx,
            session!.user.id,
            { arbreId: apresFusion.arbreId, parcelleId: apresFusion.parcelleId },
            apresFusion.date,
          ),
        )
      }
      const observation = await tx.observationSante.update({
        where: { id: obsId },
        data,
        include: {
          arbre: { select: { id: true, nom: true, type: true } },
        },
      })
      // Arrêté du 24 décembre 2025, art. 3 : l'état d'avant d'un traitement
      // du registre reste retrouvable (revue de conformité, C3).
      if (observationAuRegistre(existing)) {
        await journaliserRectificationPhyto(tx, {
          userId: session!.user.id,
          source: "observation_sante",
          sourceId: existing.id,
          action: "modification",
          avant: existing,
          apres: observation,
          motif: motifRectification(body.motif),
          auteurId: session!.user.id,
        })
      }
      return observation
    })

    return NextResponse.json(observation)
  } catch (err) {
    console.error("PUT /api/arbres/observations error:", err)
    return NextResponse.json({ error: "Erreur lors de la modification de l'observation" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const obsId = parseInt(id)
    if (isNaN(obsId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 })
    }

    const existing = await prisma.observationSante.findFirst({
      where: { id: obsId, userId: session!.user.id },
    })
    if (!existing) {
      return NextResponse.json({ error: "Observation non trouvée" }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      // Un traitement du registre ne disparaît plus sans trace (arrêté du
      // 24 décembre 2025, art. 3 ; revue de conformité du 2026-11-12, C3).
      if (observationAuRegistre(existing)) {
        await journaliserRectificationPhyto(tx, {
          userId: session!.user.id,
          source: "observation_sante",
          sourceId: existing.id,
          action: "suppression",
          avant: existing,
          motif: motifRectification(request.nextUrl.searchParams.get("motif")),
          auteurId: session!.user.id,
        })
      }
      await tx.observationSante.delete({ where: { id: obsId } })
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("DELETE /api/arbres/observations error:", err)
    return NextResponse.json({ error: "Erreur lors de la suppression" }, { status: 500 })
  }
}
