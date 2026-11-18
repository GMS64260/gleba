/**
 * Version de session (MC3, revue globale du 2026-11-11).
 *
 * Les sessions sont des jetons JWT : rien côté serveur ne les liste, donc
 * rien ne pouvait les couper quand le mot de passe change. Chaque compte porte
 * `users.session_version`, incrémentée par tout chemin qui pose un mot de
 * passe (`mot-de-passe-revocation.ts`). Le jeton reçoit la version lue à la
 * connexion ; `compte-actif.ts` la compare à la base à chaque requête
 * authentifiée : un écart coupe la session.
 *
 * Règles :
 *  - seule la connexion (`user` présent : identifiants, Google, consultation
 *    administrateur) inscrit la version dans le jeton. Le rappel `jwt` déclenché
 *    par `update` (POST /api/auth/session, ouvert à tout détenteur du cookie)
 *    ne la recopie JAMAIS, ni depuis la base ni depuis les données reçues :
 *    sinon un voleur de cookie rafraîchirait sa session révoquée ;
 *  - un jeton émis avant le déploiement n'a pas de version : il vaut 0, comme
 *    la colonne par défaut (pas de déconnexion massive au déploiement) ;
 *  - une consultation administrateur porte DEUX versions : celle du compte
 *    consulté (`sessionVersion`) et celle de l'administrateur qui l'a ouverte
 *    (`adminSessionVersion`). Un mot de passe posé sur l'un ou l'autre la
 *    coupe.
 *
 * Module sans dépendance d'exécution : il est atteignable depuis `auth.ts`,
 * donc depuis le middleware (Edge).
 */
import type { JWT } from "@auth/core/jwt"

/** Durée de vie d'une session (celle d'Auth.js par défaut, 30 jours). */
export const DUREE_SESSION_SECONDES = 30 * 24 * 60 * 60

/** Version lue dans un jeton ou une ligne : tout ce qui n'est pas un entier ≥ 0 vaut 0. */
export function versionSession(valeur: unknown): number {
  return typeof valeur === "number" && Number.isInteger(valeur) && valeur >= 0 ? valeur : 0
}

type UtilisateurConnecte = {
  id?: string
  role?: string
  impersonatedBy?: string | null
  sessionVersion?: number
  adminSessionVersion?: number | null
}

/**
 * Rappel `jwt` d'Auth.js. `trigger` et `session` sont volontairement ignorés :
 * un appel `update` rend le jeton tel quel.
 */
export function rappelJwt({ token, user }: { token: JWT; user?: UtilisateurConnecte | null; trigger?: string; session?: unknown }): JWT {
  if (user) {
    token.id = user.id
    token.role = user.role
    // null (pas undefined) pour bien RÉINITIALISER sur une connexion normale.
    token.impersonatedBy = user.impersonatedBy ?? null
    token.sessionVersion = versionSession(user.sessionVersion)
    token.adminSessionVersion = user.impersonatedBy ? versionSession(user.adminSessionVersion) : null
  }
  return token
}

type SessionBrute = {
  user?: {
    id: string
    role: string
    impersonatedBy?: string | null
    sessionVersion?: number
    adminSessionVersion?: number | null
  }
}

/** Rappel `session` d'Auth.js : expose la version du jeton à `compte-actif.ts`. */
export function rappelSession<S extends SessionBrute>({ session, token }: { session: S; token: JWT }): S {
  if (session.user) {
    session.user.id = token.id as string
    session.user.role = token.role as string
    session.user.impersonatedBy = (token.impersonatedBy as string | null) ?? null
    session.user.sessionVersion = versionSession(token.sessionVersion)
    session.user.adminSessionVersion = session.user.impersonatedBy ? versionSession(token.adminSessionVersion) : null
  }
  return session
}
