/**
 * Modes d'élevage optionnels (Phase 0).
 *
 * Activables par l'utilisateur en Paramètres pour débloquer des familles
 * d'animaux au-delà de l'élevage de rente (bétail/volaille/lapins), qui est la
 * base TOUJOURS active. Réutilise le mécanisme des modules actifs : stocké dans
 * UserPreference (clé "modesElevage", valeur = JSON string[]).
 *
 * Miroir volontaire de src/lib/modules.ts.
 * cf. docs/elevage-modes-phase0-spec.md
 */

import type { Filiere } from "@/lib/elevage/filiere"

export const ELEVAGE_MODES = {
  compagnie: {
    id: "compagnie",
    label: "Chiens & chats",
    description: "Élevage canin/félin : portées, généalogie, carnet de santé, cession",
    filiere: "compagnie",
  },
  equin: {
    id: "equin",
    label: "Équins",
    description: "Chevaux, ânes : reproduction, soins, identification SIRE",
    filiere: "equin",
  },
  nac: {
    id: "nac",
    label: "NAC",
    description: "Nouveaux animaux de compagnie : furets, rongeurs, oiseaux, reptiles",
    filiere: "nac",
  },
} as const satisfies Record<string, { id: string; label: string; description: string; filiere: Filiere }>

export type ElevageModeId = keyof typeof ELEVAGE_MODES

export const ELEVAGE_MODE_IDS: ElevageModeId[] = ["compagnie", "equin", "nac"]

export function isElevageModeId(value: unknown): value is ElevageModeId {
  return typeof value === "string" && (ELEVAGE_MODE_IDS as string[]).includes(value)
}

/**
 * Par défaut, aucun mode optionnel : seule la filière `rente` est active
 * (implicite). Un compte existant reste donc à l'identique tant qu'il ne coche
 * rien. Une liste vide est un état VALIDE (à la différence de `modulesActifs`).
 */
export const DEFAULT_MODES_ELEVAGE: ElevageModeId[] = []

export function sanitizeModesElevage(input: unknown): ElevageModeId[] {
  if (!Array.isArray(input)) return DEFAULT_MODES_ELEVAGE
  // Dédoublonne et écarte les valeurs inconnues (préférence corrompue / ancienne).
  return [...new Set(input.filter(isElevageModeId))]
}

/** Filières réellement disponibles = `rente` (toujours) + celles des modes actifs. */
export function filieresActives(modes: ElevageModeId[]): Filiere[] {
  return ["rente", ...modes.map((m) => ELEVAGE_MODES[m].filiere)]
}
