/**
 * Préférence `accueil` : chaque compte choisit son moment pour passer à
 * l'accueil v2 (« La ferme d'abord », bento). Clé/valeur dans le magasin
 * `UserPreference` existant (`/api/user/preferences`), propre à la PERSONNE.
 *
 * Module pur, sans import runtime : lu côté serveur (`/dashboard` redirige en
 * 307 avant tout rendu) et côté client (bandeau d'invitation, retour).
 */

export const CLE_PREFERENCE_ACCUEIL = "accueil"

export const VERSIONS_ACCUEIL = ["v1", "v2"] as const
export type VersionAccueil = (typeof VERSIONS_ACCUEIL)[number]

/** v1 tant que la bascule (L5) n'a pas eu lieu. */
export const VERSION_ACCUEIL_DEFAUT: VersionAccueil = "v1"

export const CHEMIN_ACCUEIL: Record<VersionAccueil, string> = {
  v1: "/dashboard",
  v2: "/aujourdhui",
}

/** Variable d'environnement qui bascule le compte démo (ses préférences sont figées). */
export const ENV_ACCUEIL_DEMO = "ACCUEIL_DEMO"

export function estVersionAccueil(value: unknown): value is VersionAccueil {
  return typeof value === "string" && (VERSIONS_ACCUEIL as readonly string[]).includes(value)
}

/** Toute valeur inconnue retombe sur la version par défaut. */
export function sanitizeVersionAccueil(input: unknown): VersionAccueil {
  return estVersionAccueil(input) ? input : VERSION_ACCUEIL_DEFAUT
}

/**
 * Version effective d'un compte : la démo suit l'environnement (ses
 * préférences sont figées en 403), les autres leur préférence.
 */
export function versionAccueilEffective(args: {
  preference: unknown
  estDemo: boolean
  accueilDemoEnv?: string | undefined
}): VersionAccueil {
  if (args.estDemo) return sanitizeVersionAccueil(args.accueilDemoEnv)
  return sanitizeVersionAccueil(args.preference)
}
