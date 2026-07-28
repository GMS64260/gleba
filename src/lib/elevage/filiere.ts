/**
 * Filière métier d'une espèce d'élevage (Phase 0 « modes d'élevage »).
 *
 * Orthogonale à EspeceAnimale.type (morphologie) et categorieReglementaire.
 * C'est la dimension qui pilote l'UI conditionnelle (cf. filiere-ui.ts) et le
 * regroupement des listes. `rente` est la base historique (bétail, volaille,
 * lapins…) ; les autres sont débloquées par les modes optionnels (cf.
 * src/lib/elevage-modes.ts).
 *
 * cf. docs/elevage-modes-phase0-spec.md
 */

export const FILIERES = ["rente", "compagnie", "equin", "nac"] as const
export type Filiere = (typeof FILIERES)[number]

export const FILIERE_DEFAULT: Filiere = "rente"

export const FILIERE_LABELS: Record<Filiere, string> = {
  rente: "Cheptel",
  compagnie: "Chiens & chats",
  equin: "Équins",
  nac: "NAC",
}

export function isFiliere(value: unknown): value is Filiere {
  return typeof value === "string" && (FILIERES as readonly string[]).includes(value)
}

/** Retombe sur la filière par défaut (`rente`) pour toute valeur inconnue/null. */
export function coerceFiliere(value: unknown): Filiere {
  return isFiliere(value) ? value : FILIERE_DEFAULT
}
