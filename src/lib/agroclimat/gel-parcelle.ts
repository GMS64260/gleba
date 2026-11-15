/**
 * Gel d'une parcelle de l'exploitation : le service commun à la route
 * `/api/agroclimat/gel` et au calendrier de semis.
 */

import prisma from "@/lib/prisma"
import { estCentroidExemple } from "@/lib/localisation-exemple"
import { SEUIL_FORTE_GELEE, SEUIL_GELEE, statistiquesGel, type StatistiquesGel } from "./gel"
import { historiqueDuPoint } from "./historique"

interface ParcelleGel {
  id: string
  nom: string
  /** Parcelle d'exemple jamais déplacée : les chiffres ne sont pas ceux de la ferme. */
  exemple: boolean
}

export type GelParcelle =
  /** Aucune parcelle géolocalisée (ou parcelle demandée introuvable). */
  | { etat: "sans_localisation" }
  /** Hors de la France métropolitaine, l'historique n'existe pas. */
  | { etat: "hors_couverture"; parcelle: ParcelleGel }
  /** Historique en cours d'import : quelques minutes la première fois. */
  | { etat: "en_preparation"; parcelle: ParcelleGel }
  | { etat: "indisponible"; parcelle: ParcelleGel }
  | {
      etat: "pret"
      parcelle: ParcelleGel
      /** Distance de la parcelle au centre de sa maille de 8 km. */
      distanceMailleKm: number
      /** Gelée : minimum sous abri à 0 °C ou moins. */
      gelee: StatistiquesGel
      /** Forte gelée : −2 °C ou moins, dégâts sur les plants et les fleurs. */
      forteGelee: StatistiquesGel
      /** Jour de la dernière donnée reçue, « AAAA-MM-JJ ». */
      actualiseLe: string | null
    }

/**
 * Gel de la parcelle demandée, ou de la parcelle de référence de
 * l'exploitation : la plus ancienne qui soit géolocalisée, pour que le choix ne
 * change pas d'un appel à l'autre. `userId` est l'exploitation (`getUserId`).
 */
export async function gelDeLaParcelle(userId: string, parcelleId?: string): Promise<GelParcelle> {
  const parcelle = await prisma.parcelleGeo.findFirst({
    where: {
      userId,
      centroidLat: { not: null },
      centroidLng: { not: null },
      ...(parcelleId ? { id: parcelleId } : {}),
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, nom: true, centroidLat: true, centroidLng: true },
  })
  if (!parcelle || parcelle.centroidLat === null || parcelle.centroidLng === null) return { etat: "sans_localisation" }

  const reference: ParcelleGel = {
    id: parcelle.id,
    nom: parcelle.nom,
    exemple: estCentroidExemple(parcelle.centroidLat, parcelle.centroidLng),
  }
  const historique = await historiqueDuPoint(parcelle.centroidLat, parcelle.centroidLng)
  if (historique.etat !== "pret") return { etat: historique.etat, parcelle: reference }

  const annees = historique.annees.map((a) => ({ annee: a.annee, tmin: a.tmin }))
  return {
    etat: "pret",
    parcelle: reference,
    distanceMailleKm: historique.maille.distanceKm,
    gelee: statistiquesGel(annees, SEUIL_GELEE),
    forteGelee: statistiquesGel(annees, SEUIL_FORTE_GELEE),
    actualiseLe: historique.actualiseLe ? historique.actualiseLe.toISOString().slice(0, 10) : null,
  }
}
