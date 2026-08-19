/**
 * Connexion Google (OAuth via Auth.js) — logique pure.
 *
 * Module volontairement léger et sans dépendance serveur : il est importé par
 * `auth.ts` (donc par le middleware) et par les pages login/register pour
 * savoir si le bouton Google doit être affiché.
 */

/** Le provider Google n'est actif que si le client OAuth est configuré. */
export function googleAuthDisponible(): boolean {
  return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET)
}

export type ProfilGoogle = {
  email?: string | null
  email_verified?: boolean | null
}

export type MotifRefusGoogle =
  | "email_manquant"
  | "email_non_verifie"
  | "compte_inactif"

/**
 * Motif de refus d'une connexion Google, ou null si elle est autorisée.
 *
 * `utilisateur` est le compte Gleba existant portant le même email (null si
 * première connexion). Une adresse non vérifiée côté Google est refusée : le
 * rattachement automatique au compte email existant
 * (allowDangerousEmailAccountLinking) n'est sûr que parce que Google garantit
 * la propriété de l'adresse.
 */
export function motifRefusConnexionGoogle(
  profil: ProfilGoogle | undefined,
  utilisateur: { active: boolean } | null
): MotifRefusGoogle | null {
  if (!profil?.email) return "email_manquant"
  if (profil.email_verified !== true) return "email_non_verifie"
  if (utilisateur && !utilisateur.active) return "compte_inactif"
  return null
}
