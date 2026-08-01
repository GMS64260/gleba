/**
 * Rattachement en masse d'arbres à une parcelle du plan.
 *
 * POST /api/arbres/bulk-parcelle
 *   body: { arbreIds: number[], parcelleGeoId: string | null }
 *   → { updated, refusedIds, conflits, avertissement }
 *
 * Né d'un retour utilisateur (2026-07-23/27) : rattacher 37 oliviers à une
 * parcelle exigeait 37 passages par la fiche arbre — l'utilisateur a cru
 * devoir créer une planche intermédiaire (qui n'existe pas pour les arbres).
 *
 * Règles reprises du PUT unitaire /api/arbres/[id] :
 * - la parcelle doit appartenir à l'utilisateur ;
 * - un couple parcelle + espèce déjà suivi en lot agrégé refuse le suivi
 *   individuel (les arbres en conflit sont renvoyés, pas silencieusement
 *   ignorés, et le reste est appliqué) ;
 * - une parcelle non catégorisée Verger est acceptée avec avertissement
 *   (le PUT unitaire ne l'impose pas non plus côté serveur).
 * - le rattachement est explicite : on ne touche ni au GPS ni aux positions.
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuthApi } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"
import { z } from "zod"
import { parcelleCompatibleVerger } from "@/lib/verger/lot-arbres"

const schema = z.object({
  arbreIds: z.array(z.coerce.number().int().positive()).min(1).max(500),
  parcelleGeoId: z.string().min(1).nullable(),
})

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const userId = session!.user.id
    const { arbreIds, parcelleGeoId } = parsed.data

    let avertissement: string | null = null
    if (parcelleGeoId) {
      const parcelle = await prisma.parcelleGeo.findFirst({
        where: { id: parcelleGeoId, userId },
        select: { id: true, nom: true, usage: true, couches: true },
      })
      if (!parcelle) {
        return NextResponse.json({ error: "Parcelle non trouvée" }, { status: 404 })
      }
      if (!parcelleCompatibleVerger(parcelle)) {
        avertissement = `La parcelle « ${parcelle.nom || parcelle.id} » n'est pas catégorisée Verger : le rattachement est fait, mais elle n'apparaîtra pas dans les listes filtrées Verger tant que la couche VERGER ne lui est pas ajoutée.`
      }
    }

    // Ne travaille que sur les arbres du tenant : un ID étranger est refusé,
    // pas silencieusement appliqué.
    const arbres = await prisma.arbre.findMany({
      where: { id: { in: arbreIds }, userId },
      select: { id: true, nom: true, espece: true, parcelleGeoId: true },
    })
    const foundIds = new Set(arbres.map((a) => a.id))
    const refusedIds = arbreIds.filter((id) => !foundIds.has(id))

    // Conflit « un seul mode de suivi » : espèces déjà suivies en lot agrégé
    // sur la parcelle cible. Comme dans le PUT unitaire, seuls les arbres dont
    // le rattachement CHANGE sont bloqués (l'historique incohérent reste modifiable).
    let conflits: Array<{ id: number; nom: string | null; espece: string | null }> = []
    let updatables = arbres
    if (parcelleGeoId) {
      const lots = await prisma.lotArbres.findMany({
        where: { userId, parcelleGeoId },
        select: { espece: true },
      })
      const especesEnLot = new Set(
        lots.map((l) => l.espece.trim().toLocaleLowerCase("fr"))
      )
      if (especesEnLot.size > 0) {
        conflits = arbres.filter(
          (a) =>
            a.parcelleGeoId !== parcelleGeoId &&
            a.espece &&
            especesEnLot.has(a.espece.trim().toLocaleLowerCase("fr"))
        )
        const conflitIds = new Set(conflits.map((c) => c.id))
        updatables = arbres.filter((a) => !conflitIds.has(a.id))
      }
    }

    let updated = 0
    if (updatables.length > 0) {
      const result = await prisma.arbre.updateMany({
        where: { id: { in: updatables.map((a) => a.id) }, userId },
        data: { parcelleGeoId },
      })
      updated = result.count
    }

    return NextResponse.json({
      updated,
      refusedIds,
      conflits: conflits.map((c) => ({ id: c.id, nom: c.nom, espece: c.espece })),
      avertissement,
    })
  } catch (err) {
    console.error("POST /api/arbres/bulk-parcelle error:", err)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
