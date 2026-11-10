/**
 * Données d'une modification partielle, réduites aux champs réellement envoyés.
 *
 * Un schéma de modification est le schéma de création passé par `.partial()`,
 * qui conserve ses `.default()` : la sortie de zod contient donc toujours les
 * champs à valeur par défaut (`actif: true`, `pays: 'France'`…), même absents de
 * la requête. Écrits tels quels, ils réactivaient une fiche désactivée et
 * remettaient son pays à « France » à la moindre correction d'un autre champ.
 * Seules les clés du corps brut disent ce que l'appelant a demandé.
 */
export function champsReellementEnvoyes<T extends Record<string, unknown>>(donnees: T, corps: unknown): T {
  const envoyes = corps && typeof corps === 'object' && !Array.isArray(corps)
    ? new Set(Object.keys(corps as Record<string, unknown>))
    : new Set<string>()
  return Object.fromEntries(Object.entries(donnees).filter(([champ]) => envoyes.has(champ))) as T
}
