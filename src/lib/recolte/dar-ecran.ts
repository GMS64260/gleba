/**
 * Affichage des avertissements renvoyés par `POST /api/recoltes` : délai avant
 * récolte d'un traitement (`warnings`) et récolte datée du jour du dernier
 * comptage de l'espèce ou d'avant (`avertissementComptage`, décision B du
 * 2026-11-25). Partagé par les écrans qui créent une récolte. La récolte est
 * enregistrée ; l'avertissement reste affiché.
 */
type Toast = (options: { variant?: 'destructive'; title: string; description: string; duration?: number }) => unknown

export function avertissementsRecolte(reponse: unknown): string[] {
  const warnings = (reponse as { warnings?: unknown } | null)?.warnings
  return Array.isArray(warnings) ? warnings.filter((m): m is string => typeof m === 'string') : []
}

export function avertissementComptageRecolte(reponse: unknown): string | null {
  const message = (reponse as { avertissementComptage?: unknown } | null)?.avertissementComptage
  return typeof message === 'string' && message.length > 0 ? message : null
}

export function signalerAvertissementsRecolte(reponse: unknown, toast: Toast): void {
  const delais = avertissementsRecolte(reponse)
  const comptage = avertissementComptageRecolte(reponse)
  // Un seul toast est visible à la fois : le comptage rejoint le dernier
  // délai avant récolte, il ne le remplace jamais.
  delais.forEach((description, i) => {
    const avecComptage = comptage && i === delais.length - 1 ? `${description} ${comptage}` : description
    toast({ variant: 'destructive', title: 'Délai avant récolte', description: avecComptage, duration: 60_000 })
  })
  if (comptage && delais.length === 0) toast({ title: 'Stock déjà compté', description: comptage, duration: 30_000 })
}
