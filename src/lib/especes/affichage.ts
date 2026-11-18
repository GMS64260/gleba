import type { OrigineBadgeReferentiel } from "@/lib/referentiel-communaute"

/** L'origine est résolue par le serveur par rapport à l'exploitation. */
export function origineBadge(o: { origine?: OrigineBadgeReferentiel }) {
  if (o.origine === "perso") return { label: "Perso", cls: "bg-amber-100 text-amber-700" }
  if (o.origine === "communaute") return { label: "Communauté", cls: "bg-sky-100 text-sky-700" }
  return null
}

/** Nom commun d'une espèce personnelle, identifiant lisible du catalogue officiel. */
export function nomEspece(o: { id: string; nom?: string | null }): string {
  return o.nom ?? o.id
}
