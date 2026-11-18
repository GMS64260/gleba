export type AssociationType = "favorable" | "incompatible" | "neutre"

export function associationDetailTitle(
  type: AssociationType | string,
  requise: boolean
): string {
  if (type === "incompatible") return "Association incompatible"
  if (type === "neutre") return "Association neutre"
  // `requise` désigne l'espèce pivot de la règle, pas une obligation.
  return requise ? "Espèce pivot (association favorable)" : "Association favorable"
}
