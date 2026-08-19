/**
 * État d'avancement d'une culture — source de vérité partagée.
 *
 * QA cmsp59tdu : l'onglet « Planifiées » listait des cultures affichées « En
 * récolte ». Deux logiques cohabitaient — un `switch` SQL côté filtre et une
 * cascade JS côté affichage — et elles ne disaient pas la même chose : le
 * filtre « Planifiée » ne testait que `semisFait`, alors que la cascade fait
 * primer `recolteFaite`. Une culture récoltée sans semis enregistré satisfaisait
 * donc le filtre tout en s'affichant « En récolte ».
 *
 * Règle unique : `etatCulture` décrit l'état affiché, `whereEtatCulture` en est
 * le miroir Prisma exact. Toute évolution doit toucher les deux ensemble — le
 * test de parité (`__tests__/etat.test.ts`) échoue sinon.
 */
import type { Prisma } from '@prisma/client'

export const ETATS_CULTURE = ['Planifiée', 'Semée', 'Plantée', 'En récolte', 'Terminée'] as const

export type EtatCulture = (typeof ETATS_CULTURE)[number]

/** Champs d'avancement lus par la cascade d'état. */
export interface CultureAvancement {
  terminee?: string | null
  semisFait?: boolean | null
  plantationFaite?: boolean | null
  recolteFaite?: boolean | null
}

/** État affiché d'une culture. Le premier jalon atteint gagne, du plus avancé au moins avancé. */
export function etatCulture(culture: CultureAvancement): EtatCulture {
  if (culture.terminee) return 'Terminée'
  if (culture.recolteFaite) return 'En récolte'
  if (culture.plantationFaite) return 'Plantée'
  if (culture.semisFait) return 'Semée'
  return 'Planifiée'
}

/**
 * Filtre Prisma sélectionnant exactement les cultures dont `etatCulture`
 * renvoie `etat` : chaque jalon plus avancé doit être explicitement exclu.
 */
export function whereEtatCulture(etat: EtatCulture): Prisma.CultureWhereInput {
  switch (etat) {
    case 'Terminée':
      return { terminee: { not: null } }
    case 'En récolte':
      return { terminee: null, recolteFaite: true }
    case 'Plantée':
      return { terminee: null, recolteFaite: false, plantationFaite: true }
    case 'Semée':
      return { terminee: null, recolteFaite: false, plantationFaite: false, semisFait: true }
    case 'Planifiée':
      return { terminee: null, recolteFaite: false, plantationFaite: false, semisFait: false }
  }
}

/** `true` si la valeur est un état connu (garde d'entrée pour un paramètre d'URL). */
export function estEtatCulture(valeur: string | null | undefined): valeur is EtatCulture {
  return !!valeur && (ETATS_CULTURE as readonly string[]).includes(valeur)
}
