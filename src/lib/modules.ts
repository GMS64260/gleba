/**
 * Définition des modules métier de Gleba.
 * Les utilisateurs peuvent activer/désactiver chacun de ces modules
 * dans leur page Paramètres pour personnaliser leur navigation.
 */

export const MODULES = {
  maraichage: { id: "maraichage", label: "Maraîchage", path: "/", description: "Cultures potagères, planches, ITPs, récoltes, calendrier lunaire" },
  verger: { id: "verger", label: "Verger & Forêt", path: "/arbres", description: "Arbres, vergers, replantation forestière, agroforesterie, haies" },
  elevage: { id: "elevage", label: "Élevage", path: "/elevage", description: "Animaux, lots, production œufs, abattages, soins, ventes" },
  comptabilite: { id: "comptabilite", label: "Comptabilité", path: "/comptabilite", description: "Factures, ventes, dépenses, TVA, clients, fournisseurs" },
} as const

export type ModuleId = keyof typeof MODULES

export const MODULE_IDS: ModuleId[] = ["maraichage", "verger", "elevage", "comptabilite"]

/** Par défaut, tous les modules sont activés (l'utilisateur masque ce qu'il n'utilise pas) */
export const DEFAULT_MODULES_ACTIFS: ModuleId[] = [...MODULE_IDS]

export function isModuleId(value: unknown): value is ModuleId {
  return typeof value === "string" && (MODULE_IDS as string[]).includes(value)
}

export function sanitizeModulesActifs(input: unknown): ModuleId[] {
  if (!Array.isArray(input)) return DEFAULT_MODULES_ACTIFS
  const filtered = input.filter(isModuleId)
  return filtered.length > 0 ? filtered : DEFAULT_MODULES_ACTIFS
}
