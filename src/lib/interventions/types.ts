/**
 * Types d'intervention culturale : une seule liste pour le formulaire, les
 * filtres, le registre et la traçabilité.
 *
 * `Intervention.type` est une chaîne libre en base : cette liste est celle que
 * l'écran propose, pas une contrainte. Un type inconnu (saisi par l'assistant,
 * importé, ou retiré de la liste) s'affiche tel quel, soulignés remplacés.
 *
 * QA cmv2r21ns (2026-10-10) — la liste ne proposait aucun geste de conduite des
 * fleurs coupées ni du repiquage : repiquage, pincement, palissage,
 * ébourgeonnage et éclaircissage sont des gestes courants en maraîchage et en
 * floriculture, qu'on rangeait en « Autre ».
 */
export const TYPES_INTERVENTION = [
  { value: "semis", label: "Semis" },
  { value: "repiquage", label: "Repiquage" },
  { value: "plantation", label: "Plantation" },
  { value: "desherbage", label: "Désherbage" },
  { value: "binage", label: "Binage" },
  { value: "eclaircissage", label: "Éclaircissage" },
  { value: "paillage", label: "Paillage" },
  { value: "traitement_phyto", label: "Traitement phyto" },
  { value: "fertilisation", label: "Fertilisation" },
  { value: "recolte", label: "Récolte" },
  { value: "taille", label: "Taille" },
  { value: "pincement", label: "Pincement" },
  { value: "ebourgeonnage", label: "Ébourgeonnage" },
  { value: "palissage", label: "Palissage" },
  { value: "tuteurage", label: "Tuteurage" },
  { value: "arrosage", label: "Arrosage" },
  { value: "autre", label: "Autre" },
] as const

export type TypeIntervention = (typeof TYPES_INTERVENTION)[number]["value"]

const LIBELLES = new Map<string, string>(TYPES_INTERVENTION.map((t) => [t.value, t.label]))

/** Libellé affiché d'un type d'intervention, accentué ; repli lisible sinon. */
export function libelleTypeIntervention(type: string | null | undefined): string {
  if (!type) return "Intervention"
  const connu = LIBELLES.get(type) ?? LIBELLES.get(type.toLowerCase())
  if (connu) return connu
  const brut = type.replace(/_/g, " ").trim()
  return brut ? brut.charAt(0).toUpperCase() + brut.slice(1) : "Intervention"
}
