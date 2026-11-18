import { courbeLactation, dim, productionRecente } from "@/lib/lait"

export type OrigineLactation = "mise_bas" | "premiere_collecte" | "inconnue"

type ProjectionLactation = {
  origineLactation: OrigineLactation
  dimEstime: boolean
  dateOrigine?: Date
  dim: number | null
  courbe: ReturnType<typeof courbeLactation>
  moyenne7j?: number | null
  joursMesures?: number
  lactationLongue: boolean
  suggererTarissement: boolean
}

/**
 * Projette les collectes triées par date croissante, déjà bornées par la route.
 * Sans mise-bas, la première collecte disponible situe seulement la courbe
 * observée : elle ne prouve pas l'âge réel de lactation et ne peut fonder
 * aucune suggestion de tarissement.
 */
export function projeterLactation({ derniereMiseBas, collectes, lactationLongue }: {
  derniereMiseBas?: Date
  collectes: Array<{ date: Date; quantiteLitres: number }>
  lactationLongue: boolean
}): ProjectionLactation {
  const dateOrigine = derniereMiseBas ?? collectes[0]?.date
  if (!dateOrigine) {
    return {
      origineLactation: "inconnue", dimEstime: false,
      dim: null, courbe: [], lactationLongue, suggererTarissement: false,
    }
  }

  const origineLactation = derniereMiseBas ? "mise_bas" : "premiere_collecte"
  const dimAct = dim(dateOrigine)
  const recente = productionRecente(collectes)
  // Règles existantes : >270 jours, ou >60 jours avec au moins trois jours
  // mesurés et une moyenne <0,5 L/j. La lactation longue exclut la suggestion.
  const suggererTarissement = origineLactation === "mise_bas" && !lactationLongue
    && (dimAct > 270 || (dimAct > 60 && recente.moyenne !== null && recente.moyenne < 0.5))

  return {
    origineLactation,
    dimEstime: origineLactation === "premiere_collecte",
    dateOrigine,
    dim: dimAct,
    courbe: courbeLactation(collectes, dateOrigine),
    moyenne7j: recente.moyenne,
    joursMesures: recente.joursMesures,
    lactationLongue,
    suggererTarissement,
  }
}
