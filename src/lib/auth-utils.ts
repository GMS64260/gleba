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
import { headers } from "next/headers"
import { resoudreContexteExploitation } from "./exploitation/membres"
import { EN_TETE_MUTATION, requeteEstMutation, valeurEnteteMutation } from "./exploitation/entete-mutation"
import { refusModuleChemin, refusMutationSiLectureSeule } from "./exploitation/garde-session"
import { ENTETE_CHEMIN } from "./abonnement/requetes"
import type { ModuleId } from "./modules"
import type { ContexteExploitation, RoleExploitation } from "./exploitation/roles"
import { refusAbonnementApi } from "./abonnement/serveur"
import { lireEtatSession } from "./compte-actif"

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
async function appliquerContexteExploitation(session: Session): Promise<SessionExploitation | null> {
  const acteurId = session.user.id
  // Rôle, compte actif et version de session relus en base : le jeton ne
  // fait pas foi (cf. `compte-actif.ts`). `null` = session à traiter comme absente.
  const [etat, contexte] = await Promise.all([
    lireEtatSession(session.user),
    resoudreContexteExploitation(acteurId) as Promise<ContexteExploitation>,
  ])
  if (!etat.actif) return null
  const effectif: ContexteExploitation = session.user.impersonatedBy
    ? { ...contexte, peutEcrire: false }
    : contexte

  return {
    ...session,
    user: {
      ...session.user,
      role: etat.role,
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
 * La requête courante modifie-t-elle des données ? L'information vient du
 * middleware (seul à connaître la méthode HTTP avant la route) via un en-tête
 * qu'il écrase systématiquement. Hors contexte de requête — cron, script — on
 * répond « non », ces chemins n'ont pas d'acteur en lecture seule.
 */
/**
 * Chemin de la requête courante, posé par le middleware (`ENTETE_CHEMIN`,
 * toujours écrasé, donc non forgeable). `null` hors contexte de requête.
 */
async function cheminRequeteCourante(): Promise<string | null> {
  try {
    const enTetes = await headers()
    return enTetes.get(ENTETE_CHEMIN)
  } catch {
    return null
  }
}

async function requeteCouranteEstMutation(): Promise<boolean> {
  try {
    const enTetes = await headers()
    return requeteEstMutation(enTetes.get(EN_TETE_MUTATION))
  } catch {
    return false
  }
}

/**
 * Récupère la session courante (Server Component, route publique)
 *
 * Attention : session BRUTE, `user.id` y est l'acteur et non le tenant. À
 * réserver aux usages d'identité. Pour toute donnée métier, passer par
 * `requireAuth` / `requireAuthApi`.
 *
 * Une session caduque (compte désactivé ou supprimé, mot de passe posé depuis
 * la connexion — MC3 —, consultation dont l'administrateur n'est plus valide)
 * vaut `null`, comme une visite anonyme : les routes publiques qui l'appellent
 * (consentement aux cookies, référentiel) ne lisent ni n'écrivent plus rien au
 * nom du compte. Même point de décision que les gardes : `lireEtatSession`.
 */
export async function getSession(): Promise<Session | null> {
  const session = await auth()
  if (!session?.user) return null
  const etat = await lireEtatSession(session.user)
  if (!etat.actif) return null
  return { ...session, user: { ...session.user, role: etat.role } }
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
  // Compte désactivé ou supprimé : passer par la route qui efface le jeton
  // (aller droit à /login bouclerait, le middleware y voit encore un connecté).
  if (!avecContexte) redirect("/api/session-terminee")
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
  if (!avecContexte) {
    return {
      error: NextResponse.json({ error: "Non autorisé" }, { status: 401 }),
      session: null,
    }
  }

  // Le seul endroit où une écriture interdite est arrêtée pour TOUTES les
  // routes. Placé après la résolution en base, donc une révocation ou un
  // changement de rôle prend effet à la requête suivante.
  const refus = refusMutationSiLectureSeule(
    avecContexte,
    request ? requeteEstMutation(valeurEnteteMutation(request.method, new URL(request.url).pathname)) : await requeteCouranteEstMutation(),
  )
  if (refus) return { error: refus, session: null }

  // Modules fermés à un membre : même point de décision pour toutes les
  // routes, lecture ET écriture, avant toute lecture métier. Table unique
  // chemin → module : `exploitation/modules-chemins.ts`.
  const refusModule = refusModuleChemin(
    avecContexte,
    request ? new URL(request.url).pathname : await cheminRequeteCourante(),
  )
  if (refusModule) return { error: refusModule, session: null }

  const refusService = await refusAbonnementApi(avecContexte.user.id, request)
  if (refusService) return { error: refusService, session: null }

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
  refusModuleChemin,
} from "./exploitation/garde-session"
