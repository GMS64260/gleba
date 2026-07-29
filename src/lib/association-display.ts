export type AssociationType = "favorable" | "incompatible" | "neutre"

export function associationDetailTitle(
  type: AssociationType | string,
  requise: boolean
): string {
  if (type === "incompatible") return "Association incompatible"
  if (type === "neutre") return "Association neutre"
  return requise ? "Association requise" : "Association favorable"
}
