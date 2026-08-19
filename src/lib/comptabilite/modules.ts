/**
 * Modules d'imputation comptable — source unique de vérité.
 *
 * `VenteManuelle.module` et `DepenseManuelle.module` sont des colonnes TEXTE
 * libres. Le formulaire de saisie n'y met que quatre valeurs
 * (`potager`, `verger`, `elevage`, `autre`), mais la base en porte deux autres,
 * écrites par des chemins internes : `general` (26 dépenses : abonnements,
 * assurances, écritures de seed) et `boutique` (23 ventes).
 *
 * Ticket cmsx69cuc (campagne QA du 2026-08-17) : chaque écran ventilait en
 * réénumérant les quatre modules connus, donc les deux valeurs hors liste
 * tombaient dans le vide. Sur l'écran Transactions, les cartes par module
 * (3 018 € de maraîchage) n'additionnaient plus le total comptable
 * (8 767 €) : 3 690 € de dépenses `general` n'étaient nulle part. Sur le
 * Compte de résultat, la ventilation rangeait TOUTES les charges manuelles en
 * « Autre » sans regarder leur module, d'où « Potager 0,00 € » face à
 * « Maraîchage 3 018,00 € » sur l'écran voisin.
 *
 * Toute surface qui ventile passe désormais par `bucketModuleCompta` : une
 * valeur inconnue est visiblement rangée en « Autre » plutôt que perdue.
 */

export const MODULES_COMPTA = ['potager', 'verger', 'elevage', 'autre'] as const

export type ModuleCompta = (typeof MODULES_COMPTA)[number]

/** Libellés affichés. « potager » se nomme Maraîchage dans l'interface. */
export const MODULE_COMPTA_LABELS: Record<ModuleCompta, string> = {
  potager: 'Maraîchage',
  verger: 'Verger',
  elevage: 'Élevage',
  autre: 'Autre',
}

/** Alias historiques rencontrés en base ou dans les URL. */
const ALIAS_MODULE: Record<string, ModuleCompta> = {
  potager: 'potager',
  maraichage: 'potager',
  verger: 'verger',
  elevage: 'elevage',
  autre: 'autre',
}

/**
 * Range un module d'imputation dans l'un des quatre postes de ventilation.
 * Tout ce qui n'est pas un module métier connu (`general`, `boutique`, vide,
 * valeur héritée) va en « Autre » : jamais ignoré, jamais perdu.
 */
export function bucketModuleCompta(module: string | null | undefined): ModuleCompta {
  if (!module) return 'autre'
  return ALIAS_MODULE[module.trim().toLowerCase()] ?? 'autre'
}

/** Ventilation vide, prête à être remplie. */
export function ventilationVide(): Record<ModuleCompta, number> {
  return { potager: 0, verger: 0, elevage: 0, autre: 0 }
}

/**
 * Ventile une collection d'écritures par module d'imputation. Le total de la
 * ventilation est, par construction, la somme des montants fournis.
 */
export function ventilerParModule<T>(
  ecritures: readonly T[],
  montant: (ecriture: T) => number,
  module: (ecriture: T) => string | null | undefined,
): Record<ModuleCompta, number> {
  const ventilation = ventilationVide()
  for (const ecriture of ecritures) {
    ventilation[bucketModuleCompta(module(ecriture))] += montant(ecriture)
  }
  return ventilation
}
