/**
 * Utilitaires d'authentification
 *
 * Invariant du chantier « exploitation partagée » (2026-08-19) : la session
 * rendue par `requireAuth` / `requireAuthApi` porte le **tenant** dans
 * `user.id` — l'exploitation dont on lit et écrit les données — et l'identité
 * réelle de la personne connectée dans `user.acteurId`.
 *
 * Conséquence pour toute route : `session.user.id` (ou `getUserId`) est le bon
 * choix pour TOUTE donnée métier ; `getActeurId` est le bon choix pour tout ce
 * qui touche la personne (mot de passe, compte, préférences, jeton d'API,
 * conversations de l'assistant, abonnements push, avis, signalements,
 * consentement, activité). Se tromper de sens est un défaut : côté métier c'est
 * une fuite entre exploitations, côté identité c'est un membre qui modifie le
 * compte du propriétaire.
 *
 * Pour un compte sans adhésion — tous les comptes existants — les deux valeurs
 * sont identiques et rien ne change.
 */

import type { Session } from "next-auth"
import { auth } from "./auth"
import { redirect } from "next/navigation"
import { NextResponse } from "next/server"
import { checkRateLimit, getClientIP } from "./rate-limit"
import { touchActivity } from "./activity"
import { resoudreContexteExploitation } from "./exploitation/membres"
import {
  installerGardeEcriture,
  poserContexteExploitation,
} from "./exploitation/garde-ecriture"
import type { ModuleId } from "./modules"
import type { ContexteExploitation, RoleExploitation } from "./exploitation/roles"

export type SessionExploitation = Session & {
  user: Session["user"] & {
    /** Identité réelle de la personne connectée (≠ `id` si elle est invitée). */
    acteurId: string
    roleExploitation: RoleExploitation
    /** `null` = aucune restriction de module. */
    modulesExploitation: ModuleId[] | null
    estProprietaireExploitation: boolean
    peutEcrireExploitation: boolean
  }
}

/**
 * Résout l'exploitation de l'acteur, arme la garde d'écriture pour la requête
 * courante, et rend une session dont `user.id` EST le tenant.
 *
 * Une consultation admin (impersonation) est traitée en lecture seule au niveau
 * des données, en plus du refus par chemin déjà posé par le middleware.
 */
async function appliquerContexteExploitation(session: Session): Promise<SessionExploitation> {
  const acteurId = session.user.id
  const contexte: ContexteExploitation = await resoudreContexteExploitation(acteurId)
  const effectif: ContexteExploitation = session.user.impersonatedBy
    ? { ...contexte, peutEcrire: false }
    : contexte

  installerGardeEcriture()
  poserContexteExploitation(effectif)

  return {
    ...session,
    user: {
      ...session.user,
      id: effectif.tenantId,
      acteurId: effectif.acteurId,
      roleExploitation: effectif.role,
      modulesExploitation: effectif.modules,
      estProprietaireExploitation: effectif.estProprietaire,
      peutEcrireExploitation: effectif.peutEcrire,
    },
  }
}

/**
 * Récupère la session courante (Server Component)
 *
 * Attention : session BRUTE, `user.id` y est l'acteur et non le tenant. À
 * réserver aux usages d'identité. Pour toute donnée métier, passer par
 * `requireAuth` / `requireAuthApi`.
 */
export async function getSession() {
  return await auth()
}

/**
 * Vérifie l'authentification - redirige vers login si non connecté
 * Pour utilisation dans les Server Components/Pages
 */
export async function requireAuth(): Promise<SessionExploitation> {
  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }
  const avecContexte = await appliquerContexteExploitation(session)
  // Une consultation admin (lecture seule) ne doit pas compter comme activité
  // de l'utilisateur consulté (stats d'usage). L'activité est celle de la
  // PERSONNE connectée, pas de l'exploitation qu'elle visite.
  if (!session.user.impersonatedBy) touchActivity(avecContexte.user.acteurId)
  return avecContexte
}

/**
 * Vérifie le rôle admin - redirige vers home si non admin
 * Pour utilisation dans les Server Components/Pages
 */
export async function requireAdmin() {
  const session = await requireAuth()
  if (session.user.role !== "ADMIN") {
    redirect("/")
  }
  return session
}

/**
 * Vérifie l'authentification pour les API routes
 * Retourne une erreur 401 si non connecté
 * Applique le rate limiting par IP (100 req/15min)
 */
export async function requireAuthApi(request?: Request): Promise<
  { error: NextResponse; session: null } | { error: null; session: SessionExploitation }
> {
  // Rate limiting par IP
  if (request) {
    const ip = getClientIP(request)
    const rateLimitError = checkRateLimit(`api:${ip}`, { windowMs: 15 * 60 * 1000, max: 100 })
    if (rateLimitError) return { error: rateLimitError, session: null }
  }

  const session = await auth()
  if (!session?.user) {
    return {
      error: NextResponse.json(
        { error: "Non autorisé" },
        { status: 401 }
      ),
      session: null,
    }
  }
  const avecContexte = await appliquerContexteExploitation(session)
  // Cf. requireAuth : pas de comptage d'activité pendant une consultation admin.
  if (!session.user.impersonatedBy) touchActivity(avecContexte.user.acteurId)
  return { error: null, session: avecContexte }
}

/**
 * Vérifie le rôle admin pour les API routes
 * Retourne une erreur 403 si non admin
 */
export async function requireAdminApi(request?: Request) {
  const { error, session } = await requireAuthApi(request)
  if (error) return { error, session: null }

  if (session!.user.role !== "ADMIN") {
    return {
      error: NextResponse.json(
        { error: "Accès interdit" },
        { status: 403 }
      ),
      session: null,
    }
  }
  return { error: null, session }
}

/**
 * Hash un mot de passe avec bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import("bcryptjs")
  return bcrypt.hash(password, 12)
}

/**
 * Vérifie un mot de passe
 */
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  const bcrypt = await import("bcryptjs")
  return bcrypt.compare(password, hashedPassword)
}

/**
 * Lecture de session et refus explicites : implémentés dans
 * `exploitation/garde-session.ts` pour rester importables sans Auth.js ni
 * Prisma (donc réellement exécutés dans les tests de routes), et ré-exportés
 * ici pour tous les appelants historiques.
 */
export {
  getUserId,
  getActeurId,
  refusSiLectureSeule,
  refusSiPasProprietaire,
} from "./exploitation/garde-session"
