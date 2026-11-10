/**
 * Affichage des avertissements de délai avant récolte renvoyés par
 * `POST /api/recoltes` (`warnings`) : partagé par les écrans qui créent une
 * récolte. La récolte est enregistrée ; l'avertissement reste une minute.
 */
type Toast = (options: { variant?: 'destructive'; title: string; description: string; duration?: number }) => unknown

export function avertissementsRecolte(reponse: unknown): string[] {
  const warnings = (reponse as { warnings?: unknown } | null)?.warnings
  return Array.isArray(warnings) ? warnings.filter((m): m is string => typeof m === 'string') : []
}

export function signalerAvertissementsRecolte(reponse: unknown, toast: Toast): void {
  for (const description of avertissementsRecolte(reponse)) {
    toast({ variant: 'destructive', title: 'Délai avant récolte', description, duration: 60_000 })
  }
}
