/**
 * Textes de l'écran « Associations de cultures » de la planification :
 * valeurs de recherche et de tri, lignes d'export.
 */

export type EvalVoisine = "favorable" | "defavorable" | "neutre"
export type Bilan = "favorable" | "defavorable" | "mixte" | "neutre"

export type LigneVoisinage = {
  plancheId: string
  ilot: string | null
  cultureEspeceId: string | null
  cultureEspeceNom?: string | null
  cultureSemaine: number | null
  planchesVoisines: string[]
  culturesVoisines: {
    plancheId: string
    especeId: string | null
    especeNom?: string | null
    memePlanche?: boolean
    eval: EvalVoisine
  }[]
  scoreAssociation: Bilan
}

const LIBELLE_BILAN: Record<Bilan, string> = {
  favorable: "Favorable",
  defavorable: "Défavorable",
  mixte: "Mixte",
  neutre: "Neutre",
}

/** Libellé du bilan : sert à l'affichage, à la recherche et au tri. */
export function libelleBilan(score: Bilan): string {
  return LIBELLE_BILAN[score] ?? "Neutre"
}

const SIGNE: Record<EvalVoisine, string> = { favorable: "favorable", defavorable: "défavorable", neutre: "neutre" }

/** Cultures voisines en texte : « B2 : Tomate (favorable) ». */
export function texteCulturesVoisines(ligne: Pick<LigneVoisinage, "culturesVoisines">): string {
  return ligne.culturesVoisines
    .map(
      (cv) =>
        `${cv.memePlanche ? "même planche" : cv.plancheId} : ${cv.especeNom || cv.especeId || "?"} (${SIGNE[cv.eval] ?? "neutre"})`
    )
    .join(", ")
}

/** Lignes de l'export (en-tête comprise), à passer à `telechargerCsv`. */
export function lignesCsvVoisinage(data: LigneVoisinage[]): (string | number)[][] {
  return [
    ["Planche", "Îlot", "Culture", "Semaine", "Planches voisines", "Cultures voisines", "Bilan"],
    ...data.map((a) => [
      a.plancheId,
      a.ilot || "",
      a.cultureEspeceNom || a.cultureEspeceId || "",
      a.cultureSemaine ?? "",
      a.planchesVoisines.join(", "),
      texteCulturesVoisines(a),
      libelleBilan(a.scoreAssociation),
    ]),
  ]
}
