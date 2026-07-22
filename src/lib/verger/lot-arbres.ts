export const parcelleCompatibleVerger = (parcelle: { usage: string | null; couches: string[] }) =>
  parcelle.couches.includes("VERGER") ||
  (parcelle.usage ?? "").split(",").some((usage) => usage.trim().toLowerCase() === "verger")

export function validerLotArbres(input: { nom?: unknown; espece?: unknown; effectif?: unknown; parcelleGeoId?: unknown }) {
  const nom = typeof input.nom === "string" ? input.nom.trim() : ""
  const espece = typeof input.espece === "string" ? input.espece.trim() : ""
  const effectif = Number(input.effectif)
  const parcelleGeoId = typeof input.parcelleGeoId === "string" ? input.parcelleGeoId.trim() : ""
  if (!nom) return "Le nom du lot est requis"
  if (!espece) return "L’espèce du lot est requise"
  if (!Number.isInteger(effectif) || effectif <= 0) return "L’effectif doit être un entier strictement positif"
  if (!parcelleGeoId) return "Une parcelle verger est requise"
  return null
}
