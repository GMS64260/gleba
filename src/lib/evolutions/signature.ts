/** Nom déjà public de l'auteur, ou signature générique quand il n'est pas renseigné. */
export function signatureEvolution(name: string | null): string {
  return name?.trim() ? name : "Contributeur"
}
