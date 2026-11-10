/**
 * État du compte relu en base à chaque requête authentifiée.
 *
 * Le jeton de session (JWT) porte le rôle et ne connaît pas `active` : un
 * administrateur rétrogradé gardait ses droits, et un compte désactivé son
 * accès, jusqu'à l'expiration du jeton. La base fait foi :
 *  - compte absent ou désactivé : la session ne vaut plus rien ;
 *  - rôle : celui de la base remplace celui du jeton ;
 *  - consultation par un administrateur (`impersonatedBy`) : elle tombe dès
 *    que cet administrateur n'est plus un administrateur actif.
 *
 * Une panne de lecture n'est pas rattrapée : sans base, on n'accorde rien.
 */
import prisma from "@/lib/prisma"

export type EtatCompte = { actif: true; role: string } | { actif: false }

export async function lireEtatCompte(acteurId: string, adminId?: string | null): Promise<EtatCompte> {
  if (!acteurId) return { actif: false }
  const ids = adminId ? [acteurId, adminId] : [acteurId]
  const comptes = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, active: true, role: true },
  })
  const acteur = comptes.find((c) => c.id === acteurId)
  if (!acteur || !acteur.active) return { actif: false }
  if (adminId) {
    const admin = comptes.find((c) => c.id === adminId)
    if (!admin || !admin.active || admin.role !== "ADMIN") return { actif: false }
  }
  return { actif: true, role: acteur.role }
}
