/**
 * Avertissements non bloquants d'une réponse de mutation de culture
 * (`warnings` du PUT et du PATCH, `avertissements` de bulk-fait) : la mutation
 * est enregistrée, l'écran doit seulement le dire.
 */
export const TITRE_AVERTISSEMENT_CULTURE = 'Enregistré, planche à vérifier'

export function avertissementsReponse(corps: unknown): string[] {
  if (!corps || typeof corps !== 'object') return []
  const { warnings, avertissements } = corps as { warnings?: unknown; avertissements?: unknown }
  const messages: unknown[] = [
    ...(Array.isArray(warnings) ? warnings : []),
    ...(Array.isArray(avertissements) ? avertissements.map((a) => (a as { message?: unknown } | null)?.message) : []),
  ]
  return messages.filter((m): m is string => typeof m === 'string' && m.length > 0)
}
