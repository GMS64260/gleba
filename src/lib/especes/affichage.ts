/** Une origine communautaire ne peut être affirmée sans connaître le compte courant. */
export function origineBadge(o: { userId?: string | null }, currentUserId?: string | null) {
  if (o.userId == null || !currentUserId) return null
  if (o.userId === currentUserId) return { label: "Perso", cls: "bg-amber-100 text-amber-700" }
  return { label: "Communauté", cls: "bg-sky-100 text-sky-700" }
}

/** Nom commun d'une espèce personnelle, identifiant lisible du catalogue officiel. */
export function nomEspece(o: { id: string; nom?: string | null }): string {
  return o.nom ?? o.id
}
