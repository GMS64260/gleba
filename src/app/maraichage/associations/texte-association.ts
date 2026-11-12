/**
 * Textes de l'écran des associations : valeurs de recherche et lignes d'export.
 *
 * Le filtre global du tableau n'interroge que les colonnes dont la valeur est
 * une chaîne ou un nombre sur la PREMIÈRE ligne : une colonne `details`
 * (tableau) ou une description nulle en tête de liste rendaient la recherche
 * aveugle (« Concombre » ne trouvait pas « Chou brocoli + »). Ces fonctions
 * rendent donc toujours une chaîne.
 */

export type AssociationListee = {
  nom: string
  type: string
  description: string | null
  details: {
    especeId: string | null
    familleId: string | null
    groupe: string | null
    requise: boolean
  }[]
}

export function libelleType(type: string): string {
  if (type === "incompatible") return "Incompatible"
  if (type === "neutre") return "Neutre"
  return "Favorable"
}

/** Membres d'une association, en texte cherchable. */
export function texteDetails(a: Pick<AssociationListee, "details">): string {
  return (a.details ?? [])
    .map((d) => d.especeId || d.familleId || d.groupe || "")
    .filter(Boolean)
    .join(", ")
}

export function texteDescription(a: Pick<AssociationListee, "description">): string {
  return a.description ?? ""
}

/** Lignes de l'export (en-tête comprise), à passer à `telechargerCsv`. */
export function lignesCsvAssociations(data: AssociationListee[]): (string | number)[][] {
  return [
    ["Nom", "Type", "Description", "Espèces", "Familles", "Groupes", "Espèces pivots (★)", "Nb total"],
    ...data.map((a) => [
      a.nom,
      libelleType(a.type),
      a.description || "",
      a.details.filter((d) => d.especeId).map((d) => d.especeId).join(", "),
      // La famille d'une ligne d'espèce n'est qu'une annotation : seules les
      // lignes sans espèce désignent une famille ou un groupe entiers.
      a.details.filter((d) => !d.especeId && d.familleId).map((d) => d.familleId).join(", "),
      a.details.filter((d) => !d.especeId && d.groupe).map((d) => d.groupe).join(", "),
      a.details.filter((d) => d.requise).map((d) => d.especeId || d.familleId || d.groupe).join(", "),
      a.details.length,
    ]),
  ]
}
