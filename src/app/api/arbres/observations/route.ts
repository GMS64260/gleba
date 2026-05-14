/**
 * API Routes pour les Observations de santé des arbres
 * GET /api/arbres/observations - Liste des observations (filtrable)
 * POST /api/arbres/observations - Créer une observation
 */
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = session!.user.id
    const searchParams = request.nextUrl.searchParams
    const arbreId = searchParams.get("arbreId")
    const type = searchParams.get("type")
    const gravite = searchParams.get("gravite")
    const resolu = searchParams.get("resolu")

    const where: Record<string, unknown> = { userId }
    if (arbreId) where.arbreId = parseInt(arbreId)
    if (type && type !== "all") where.type = type
    if (gravite && gravite !== "all") where.gravite = gravite
    if (resolu !== null && resolu !== "all") {
      if (resolu === "true") where.resolu = true
      if (resolu === "false") where.resolu = false
    }

    const observations = await prisma.observationSante.findMany({
      where,
      include: {
        arbre: {
          select: { id: true, nom: true, type: true, espece: true },
        },
      },
      orderBy: { date: "desc" },
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

    // DEV3 audit Marc — Bloquant #1
    // Validation des champs réglementaires obligatoires pour méthodes
    // chimiques (chimique_conventionnel, chimique_cuivre).
    const isChimique =
      body.methodeTraitement === "chimique_conventionnel" ||
      body.methodeTraitement === "chimique_cuivre" ||
      body.methodeTraitement === "chimique"
    if (isChimique) {
      const manquants: string[] = []
      if (!body.numAMM) manquants.push("N° AMM")
      if (body.surfaceTraiteeHa == null) manquants.push("Surface traitée (ha)")
      if (body.volumeBouillieLHa == null && body.volumeBouillieLTotal == null)
        manquants.push("Volume de bouillie")
      if (body.temperatureC == null) manquants.push("Température (°C)")
      if (body.ventKmh == null) manquants.push("Vent (km/h)")
      if (body.hygrometriePct == null) manquants.push("Hygrométrie (%)")
      if (body.pluie24h == null) manquants.push("Pluie ±24h")
      if (!body.certiphytoNum) manquants.push("N° Certiphyto opérateur")
      if (body.zntRespectee == null) manquants.push("ZNT cours d'eau")
      if (manquants.length > 0) {
        return NextResponse.json(
          {
            error:
              "Champs réglementaires manquants (Arrêté 16/06/2009) : " +
              manquants.join(", "),
            manquants,
          },
          { status: 400 }
        )
      }
    }

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
        notes: body.notes || null,
        // PROMPT 11 LOT D — PBI
        stadeBBCH: body.stadeBBCH || null,
        pctOrganesTouches: body.pctOrganesTouches != null ? parseInt(body.pctOrganesTouches) : null,
        photoUrl: body.photoUrl || null,
        // DEV3 #1 — Champs réglementaires (Arrêté 16/06/2009)
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
        parcelleId: body.parcelleId || null,
        operateurId: body.operateurId || null,
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
