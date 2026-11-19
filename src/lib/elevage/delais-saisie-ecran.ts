/**
 * Côté écran : lire le refus « délais d'attente requis » d'une validation de
 * soin et préparer le corps qui la rejoue avec les délais saisis sur place.
 * Sans cela, les boutons « Fait » affichaient le refus sans issue : il fallait
 * deviner qu'on devait rouvrir le formulaire du soin.
 */
import {
  CHAMP_DELAI, CODE_DELAIS_ATTENTE_REQUIS, LIBELLE_DELAI, type DelaiAttente,
} from '@/lib/elevage/delais-saisie-libre'

const DELAIS: readonly DelaiAttente[] = ['viande', 'lait', 'oeufs']
export const DELAI_ATTENTE_MAX_J = 365

/** Délais manquants annoncés par le serveur, ou `null` si le refus est autre. */
export function delaisManquantsDuRefus(status: number, corps: unknown): DelaiAttente[] | null {
  if (status !== 422 || !corps || typeof corps !== 'object') return null
  const { code, delaisManquants } = corps as { code?: unknown; delaisManquants?: unknown }
  if (code !== CODE_DELAIS_ATTENTE_REQUIS || !Array.isArray(delaisManquants)) return null
  const manquants = DELAIS.filter((delai) => delaisManquants.includes(delai))
  return manquants.length > 0 ? manquants : null
}

export const libelleDelaiAttente = (delai: DelaiAttente) => `Attente ${LIBELLE_DELAI[delai]} (jours)`

/**
 * Champs `tempsAttente…J` à joindre à la validation rejouée ; `null` tant
 * qu'un délai demandé n'est pas un entier de 0 à 365 (zéro est une réponse).
 */
export function corpsDelaisSaisis(
  manquants: readonly DelaiAttente[],
  saisie: Partial<Record<DelaiAttente, string>>,
): Record<string, number> | null {
  const corps: Record<string, number> = {}
  for (const delai of manquants) {
    const texte = (saisie[delai] ?? '').trim()
    if (!/^\d+$/.test(texte)) return null
    const jours = Number(texte)
    if (jours > DELAI_ATTENTE_MAX_J) return null
    corps[CHAMP_DELAI[delai]] = jours
  }
  return corps
}
