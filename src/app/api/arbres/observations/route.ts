/**
 * API Routes pour les Observations de santé des arbres
 * GET /api/arbres/observations - Liste des observations (filtrable)
 * POST /api/arbres/observations - Créer une observation
 */
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"
import { listerObservationsSante } from "@/lib/observations-sante"
import { MESSAGE_AMM_INVALIDE, numAMMValide } from "@/lib/tracabilite/amm"
import { notesAvecOperateur } from "@/lib/tracabilite/projection-phyto"
import { resoudreOperateurExploitation } from "@/lib/tracabilite/operateur-exploitation"
import {
  MESSAGE_CHAMPS_REGLEMENTAIRES,
  champsManquantsObservationPhyto,
} from "@/lib/tracabilite/conformite-observation-phyto"

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const searchParams = request.nextUrl.searchParams
    const arbreId = searchParams.get("arbreId")
    const resolu = searchParams.get("resolu")

    // La lecture vit dans src/lib/observations-sante.ts (SSOT partagée avec
    // l'outil assistant `get_observations_sante`) — lot assistant 2026-08-11.
    const observations = await listerObservationsSante(session!.user.id, {
      arbreId: arbreId ? parseInt(arbreId) : undefined,
      type: searchParams.get("type") ?? undefined,
      gravite: searchParams.get("gravite") ?? undefined,
      resolu: resolu === "true" ? true : resolu === "false" ? false : undefined,
    })

    return NextResponse.json(observations)
  } catch (err) {
    console.error("GET /api/arbres/observations error:", err)
    return NextResponse.json({ error: "Erreur lors de la récupération des observations" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()

    if (!body.arbreId) {
      return NextResponse.json({ error: "L'arbre est requis" }, { status: 400 })
    }
    if (!body.type) {
      return NextResponse.json({ error: "Le type d'observation est requis" }, { status: 400 })
    }

    // Vérifier que l'arbre appartient à l'utilisateur
    const arbre = await prisma.arbre.findFirst({
      where: { id: parseInt(body.arbreId), userId: session!.user.id },
    })
    if (!arbre) {
      return NextResponse.json({ error: "Arbre non trouvé" }, { status: 404 })
    }

    // QA cmv2962ey — même règle de forme que les interventions : sept chiffres ou vide.
    if (body.numAMM && !numAMMValide(String(body.numAMM))) {
      return NextResponse.json({ error: MESSAGE_AMM_INVALIDE }, { status: 400 })
    }

    // DEV3 audit Marc — Bloquant #1, revue cmvgeltj1 (2026-10-20) : champs
    // réglementaires d'une méthode chimique, même liste que la conformité de
    // la ligne au registre général (conformite-observation-phyto.ts).
    const manquants = champsManquantsObservationPhyto(body).map((champ) => champ.libelle)
    if (manquants.length > 0) {
      return NextResponse.json(
        { error: MESSAGE_CHAMPS_REGLEMENTAIRES + manquants.join(", "), manquants },
        { status: 400 },
      )
    }

    // Parcelle du traitement : clé étrangère revalidée en appartenance (son nom
    // sort au registre phytosanitaire).
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

    // Revue cmvgeltj1 — l'opérateur désigné sort en Applicateur au registre :
    // titulaire ou membre de l'exploitation seulement, sinon refus nommé.
    const operateur = await resoudreOperateurExploitation(session!.user.id, body.operateurId)
    if ("refus" in operateur) {
      return NextResponse.json({ error: operateur.refus }, { status: 400 })
    }
    const operateurId = operateur.operateurId

    const observation = await prisma.observationSante.create({
      data: {
        userId: session!.user.id,
        arbreId: parseInt(body.arbreId),
        date: body.date ? new Date(body.date) : new Date(),
        type: body.type,
        symptome: body.symptome || null,
        diagnostic: body.diagnostic || null,
        gravite: body.gravite || "faible",
        organe: body.organe || null,
        traitement: body.traitement || null,
        methodeTraitement: body.methodeTraitement || null,
        produit: body.produit || null,
        doseAppliquee: body.doseAppliquee ? parseFloat(body.doseAppliquee) : null,
        uniteDose: body.uniteDose || null,
        dar: body.dar ? parseInt(body.dar) : null,
        numAMM: body.numAMM || null,
        resolu: body.resolu || false,
        dateResolution: body.dateResolution ? new Date(body.dateResolution) : null,
        // QA cmvgeltj1 — l'opérateur est saisi en texte libre (`operateurNom`) ;
        // `operateurId` est une clé étrangère vers un compte. Le nom est conservé
        // dans les notes au format relu par le registre général et l'export.
        notes: notesAvecOperateur(
          typeof body.notes === "string" ? body.notes : null,
          typeof body.operateurNom === "string" ? body.operateurNom : null,
        ),
        // PROMPT 11 LOT D — PBI
        stadeBBCH: body.stadeBBCH || null,
        pctOrganesTouches: body.pctOrganesTouches != null ? parseInt(body.pctOrganesTouches) : null,
        photoUrl: body.photoUrl || null,
        // DEV3 #1 — Champs réglementaires (arrêté du 4 mai 2017 modifié)
        surfaceTraiteeHa: body.surfaceTraiteeHa != null ? parseFloat(body.surfaceTraiteeHa) : null,
        volumeBouillieLHa: body.volumeBouillieLHa != null ? parseFloat(body.volumeBouillieLHa) : null,
        volumeBouillieLTotal: body.volumeBouillieLTotal != null ? parseFloat(body.volumeBouillieLTotal) : null,
        temperatureC: body.temperatureC != null ? parseFloat(body.temperatureC) : null,
        ventKmh: body.ventKmh != null ? parseFloat(body.ventKmh) : null,
        hygrometriePct: body.hygrometriePct != null ? parseInt(body.hygrometriePct) : null,
        pluie24h: body.pluie24h != null ? Boolean(body.pluie24h) : null,
        pluie24hMm: body.pluie24hMm != null ? parseFloat(body.pluie24hMm) : null,
        epiPortes: Array.isArray(body.epiPortes) ? body.epiPortes : [],
        zntRespectee: body.zntRespectee != null ? Boolean(body.zntRespectee) : null,
        zntDistanceM: body.zntDistanceM != null ? parseInt(body.zntDistanceM) : null,
        parcelleId,
        // `operateurId` est une FK vers User : toute autre valeur (le front a
        // historiquement envoyé du texte libre) provoquerait une violation FK.
        operateurId: operateurId,
        certiphytoNum: body.certiphytoNum || null,
      },
      include: {
        arbre: {
          select: { id: true, nom: true, type: true },
        },
      },
    })

    return NextResponse.json(observation, { status: 201 })
  } catch (err) {
    console.error("POST /api/arbres/observations error:", err)
    return NextResponse.json({ error: "Erreur lors de la création de l'observation" }, { status: 500 })
  }
}
