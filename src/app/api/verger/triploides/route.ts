/**
 * Détection arbres triploïdes sans pollinisateur diploïde (PROMPT 23 §2).
 *
 * GET /api/verger/triploides
 *   → { alertes: [{ arbre, raison, pollinisateursOK, manquant }] }
 *
 * Pour chaque arbre triploïde du user, on regarde les arbres voisins
 * (< 30 m via lat/lng si présents, sinon "même parcelle/zone") et on
 * compte les pollinisateurs diploïdes compatibles.
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuthApi } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"
import {
  isTriploide,
  analyserPollinisationTriploide,
  distanceMetres,
  DISTANCE_MAX_POLLINISATION_M,
} from "@/lib/pollinisation"
import { normalizeVarieteName } from "@/lib/normalize"

export async function GET(_request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  // Charger tous les arbres avec leur variété (ploidie/groupePollinisation)
  // et leur position GPS si disponible
  const arbres = await prisma.arbre.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      nom: true,
      espece: true,
      variete: true,
      gpsLat: true,
      gpsLng: true,
      // zoneId pour fallback voisinage si pas de GPS
      zoneId: true,
    },
  })

  // Hydrater chaque variété via la table Variete (par nomNormalise approximatif)
  // Pour rester simple, on indexe en mémoire par nom normalisé en lowercase.
  // `nomNormalise` est désaccentué et sans tirets : il faut requêter et
  // indexer avec la même normalisation (normalizeVarieteName), sinon les
  // variétés accentuées ou à tirets ne matchent jamais.
  const noms = Array.from(new Set(arbres.map((a) => a.variete).filter(Boolean) as string[]))
  const varietes = noms.length
    ? await prisma.variete.findMany({
        where: { nomNormalise: { in: noms.map((n) => normalizeVarieteName(n)) } },
        select: { nomNormalise: true, ploidie: true, groupePollinisation: true },
      })
    : []
  const idxVar = new Map(varietes.map((v) => [v.nomNormalise, v]))

  // Enrichir chaque arbre avec ploidie/groupe
  type EnrichedArbre = (typeof arbres)[number] & { ploidie: string | null; groupePollinisation: string | null }
  const enriched: EnrichedArbre[] = arbres.map((a) => {
    const v = a.variete ? idxVar.get(normalizeVarieteName(a.variete)) : undefined
    return { ...a, ploidie: v?.ploidie ?? null, groupePollinisation: v?.groupePollinisation ?? null }
  })

  const alertes = enriched
    .filter((a) => isTriploide({ nomNormalise: a.variete, ploidie: a.ploidie }))
    .map((arbre) => {
      // Voisins : même espèce uniquement (un cerisier ne pollinise pas un
      // pommier), puis GPS < 30 m OU même zone si pas de GPS
      const voisins = enriched
        .filter((v) => v.id !== arbre.id)
        .filter((v) => v.espece && arbre.espece && v.espece === arbre.espece)
        .filter((v) => {
          if (arbre.gpsLat != null && v.gpsLat != null) {
            return distanceMetres(
              { latitude: arbre.gpsLat, longitude: arbre.gpsLng },
              { latitude: v.gpsLat, longitude: v.gpsLng }
            ) <= DISTANCE_MAX_POLLINISATION_M
          }
          // Fallback : même zone du verger
          return arbre.zoneId && v.zoneId === arbre.zoneId
        })

      const analyse = analyserPollinisationTriploide(
        { groupePollinisation: arbre.groupePollinisation },
        voisins
      )
      return {
        arbre: { id: arbre.id, nom: arbre.nom, variete: arbre.variete, espece: arbre.espece },
        ...analyse,
      }
    })
    .filter((a) => !a.ok)

  return NextResponse.json({ alertes, distanceMaxM: DISTANCE_MAX_POLLINISATION_M })
}
