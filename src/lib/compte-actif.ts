/**
 * État du compte relu en base à chaque requête authentifiée.
 *
 * Le jeton de session (JWT) porte le rôle et ne connaît pas `active` : un
 * administrateur rétrogradé gardait ses droits, et un compte désactivé son
 * accès, jusqu'à l'expiration du jeton. La base fait foi :
 *  - compte absent ou désactivé : la session ne vaut plus rien ;
 *  - rôle : celui de la base remplace celui du jeton ;
 *  - consultation par un administrateur (`impersonatedBy`) : elle tombe dès
 *    que cet administrateur n'est plus un administrateur actif ;
 *  - version de session (MC3) : un mot de passe posé depuis l'émission du
 *    jeton l'a rendu caduc. Une consultation compare les deux versions : celle
 *    du compte consulté (`session.user.id`) et celle de l'administrateur qui
 *    l'a ouverte. Un jeton sans version vaut 0.
 *
 * `lireEtatSession` est le point d'entrée des gardes : il passe toutes les
 * informations du jeton, aucun appelant ne peut en oublier une.
 *
 * Une panne de lecture n'est pas rattrapée : sans base, on n'accorde rien.
 */
import prisma from "@/lib/prisma"
import { versionSession } from "@/lib/session-version"

export type EtatCompte =
  | { actif: true; role: string }
  | { actif: false; motif?: "session_revoquee" }

export async function lireEtatCompte(
  acteurId: string,
  adminId?: string | null,
  versionJeton?: number | null,
  versionAdminJeton?: number | null,
): Promise<EtatCompte> {
  if (!acteurId) return { actif: false }
  const ids = adminId ? [acteurId, adminId] : [acteurId]
  const comptes = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, active: true, role: true, sessionVersion: true },
  })
  const acteur = comptes.find((c) => c.id === acteurId)
  if (!acteur || !acteur.active) return { actif: false }
  if (versionSession(acteur.sessionVersion) !== versionSession(versionJeton)) {
    return { actif: false, motif: "session_revoquee" }
  }
  if (adminId) {
    const admin = comptes.find((c) => c.id === adminId)
    if (!admin || !admin.active || admin.role !== "ADMIN") return { actif: false }
    if (versionSession(admin.sessionVersion) !== versionSession(versionAdminJeton)) {
      return { actif: false, motif: "session_revoquee" }
    }
  }
  return { actif: true, role: acteur.role }
}

/** Utilisateur d'une session brute (`auth()`), tel que l'exposent les rappels de `session-version.ts`. */
export type UtilisateurSession = {
  id: string
  impersonatedBy?: string | null
  sessionVersion?: number | null
  adminSessionVersion?: number | null
}

/** État du compte d'une session brute : identité, activité, versions (MC3). */
export function lireEtatSession(user: UtilisateurSession): Promise<EtatCompte> {
  return lireEtatCompte(user.id, user.impersonatedBy, user.sessionVersion, user.adminSessionVersion)
}
