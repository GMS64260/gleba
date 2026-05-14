/**
 * API Routes pour une Observation de santé spécifique
 * PUT /api/arbres/observations/:id - Modifier (toggle résolu, etc.)
 * DELETE /api/arbres/observations/:id - Supprimer
 */
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const obsId = parseInt(id)
    const body = await request.json()

    const existing = await prisma.observationSante.findFirst({
      where: { id: obsId, userId: session!.user.id },
    })
    if (!existing) {
      return NextResponse.json({ error: "Observation non trouvée" }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (body.type !== undefined) data.type = body.type
    if (body.symptome !== undefined) data.symptome = body.symptome
    if (body.diagnostic !== undefined) data.diagnostic = body.diagnostic
    if (body.gravite !== undefined) data.gravite = body.gravite
    if (body.organe !== undefined) data.organe = body.organe
    if (body.traitement !== undefined) data.traitement = body.traitement
    if (body.methodeTraitement !== undefined) data.methodeTraitement = body.methodeTraitement
    if (body.produit !== undefined) data.produit = body.produit
    if (body.doseAppliquee !== undefined) data.doseAppliquee = body.doseAppliquee ? parseFloat(body.doseAppliquee) : null
    if (body.uniteDose !== undefined) data.uniteDose = body.uniteDose
    if (body.dar !== undefined) data.dar = body.dar ? parseInt(body.dar) : null
    if (body.numAMM !== undefined) data.numAMM = body.numAMM
    if (body.notes !== undefined) data.notes = body.notes
    // PROMPT 11 LOT D — PBI
    if (body.stadeBBCH !== undefined) data.stadeBBCH = body.stadeBBCH || null
    if (body.pctOrganesTouches !== undefined) data.pctOrganesTouches = body.pctOrganesTouches == null ? null : parseInt(body.pctOrganesTouches)
    if (body.photoUrl !== undefined) data.photoUrl = body.photoUrl || null
    // DEV3 #1 — Champs réglementaires (Arrêté 16/06/2009)
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
    if (body.parcelleId !== undefined) data.parcelleId = body.parcelleId || null
    if (body.operateurId !== undefined) data.operateurId = body.operateurId || null
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

    // DEV3 audit fix — Validation PUT : si la méthode finale (post-merge) est
    // chimique, vérifier que les champs réglementaires obligatoires ne sont
    // pas vidés. Évite un trou de conformité Arrêté 16/06/2009 où on créerait
    // en règle puis on viderait via PATCH.
    const methodeFinale = data.methodeTraitement ?? existing.methodeTraitement
    const isChimique =
      methodeFinale === "chimique_conventionnel" ||
      methodeFinale === "chimique_cuivre" ||
      methodeFinale === "chimique"
    if (isChimique) {
      const get = (k: string, oldVal: unknown) =>
        k in data ? (data as Record<string, unknown>)[k] : oldVal
      const numAMMFinal = get("numAMM", existing.numAMM)
      const surfaceFinal = get("surfaceTraiteeHa", existing.surfaceTraiteeHa)
      const volumeFinal = get("volumeBouillieLHa", existing.volumeBouillieLHa) ?? get("volumeBouillieLTotal", existing.volumeBouillieLTotal)
      const tempFinal = get("temperatureC", existing.temperatureC)
      const ventFinal = get("ventKmh", existing.ventKmh)
      const hygroFinal = get("hygrometriePct", existing.hygrometriePct)
      const pluieFinal = get("pluie24h", existing.pluie24h)
      const certiFinal = get("certiphytoNum", existing.certiphytoNum)
      const zntFinal = get("zntRespectee", existing.zntRespectee)

      const manquants: string[] = []
      if (!numAMMFinal) manquants.push("N° AMM")
      if (surfaceFinal == null) manquants.push("Surface traitée (ha)")
      if (volumeFinal == null) manquants.push("Volume de bouillie")
      if (tempFinal == null) manquants.push("Température (°C)")
      if (ventFinal == null) manquants.push("Vent (km/h)")
      if (hygroFinal == null) manquants.push("Hygrométrie (%)")
      if (pluieFinal == null) manquants.push("Pluie ±24h")
      if (!certiFinal) manquants.push("N° Certiphyto opérateur")
      if (zntFinal == null) manquants.push("ZNT cours d'eau")
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

    const observation = await prisma.observationSante.update({
      where: { id: obsId },
      data,
      include: {
        arbre: { select: { id: true, nom: true, type: true } },
      },
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

    const existing = await prisma.observationSante.findFirst({
      where: { id: obsId, userId: session!.user.id },
    })
    if (!existing) {
      return NextResponse.json({ error: "Observation non trouvée" }, { status: 404 })
    }

    await prisma.observationSante.delete({ where: { id: obsId } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("DELETE /api/arbres/observations error:", err)
    return NextResponse.json({ error: "Erreur lors de la suppression" }, { status: 500 })
  }
}
