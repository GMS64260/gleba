const OPERATION_LABELS: Record<string, string> = {
  taille: "Taille",
  traitement: "Traitement",
  fertilisation: "Fertilisation",
  recolte: "Récolte",
  greffe: "Greffe",
  autre: "Autre",
}

export function libelleOperationArbre(type: string): string {
  const code = type.trim().toLocaleLowerCase("fr-FR")
  return OPERATION_LABELS[code] ?? type
}
