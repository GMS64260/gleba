/**
 * Configuration NextAuth.js v5 (Auth.js)
 */

import NextAuth, { CredentialsSignin } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import type { Adapter, AdapterAccount, AdapterUser } from "next-auth/adapters"
import bcrypt from "bcryptjs"
import prisma from "./prisma"
import {
  consommerJetonImpersonation,
  hashJeton,
} from "./impersonation"
import { googleAuthDisponible, motifRefusConnexionGoogle } from "./auth-google"
import { estEmailDemo } from "./demo"
import { REFUS_CONNEXION, type CodeRefusConnexion } from "./auth-refus"

/**
 * Refus de connexion porteur d'un motif lisible par le formulaire.
 *
 * `throw new Error("Email non vérifié…")` ne sort PAS d'Auth.js : le message
 * est journalisé côté serveur et le client ne reçoit qu'un code générique.
 * Seule la propriété `code` d'une sous-classe de `CredentialsSignin` traverse.
 * Le vocabulaire et le compromis d'énumération vivent dans `auth-refus.ts`.
 */
class RefusConnexion extends CredentialsSignin {
  code: string

  constructor(code: CodeRefusConnexion) {
    super()
    this.code = code
  }
}

/** Extrait l'IP réelle et le user-agent depuis les en-têtes (derrière Caddy) */
function clientInfo(request?: Request): { ip: string | null; userAgent: string | null } {
  if (!request) return { ip: null, userAgent: null }
  const h = request.headers
  // Caddy place l'IP réelle dans X-Forwarded-For (liste séparée par des virgules : le 1er = client)
  const xff = h.get("x-forwarded-for")
  const ip = (xff?.split(",")[0].trim() || h.get("x-real-ip") || "").trim() || null
  const userAgent = h.get("user-agent")?.slice(0, 512) ?? null
  return { ip, userAgent }
}

/** Log une tentative de connexion (fire-and-forget) */
function logLogin(
  email: string,
  success: boolean,
  reason: string,
  userId?: string,
  info?: { ip: string | null; userAgent: string | null }
) {
  prisma.loginLog.create({
    data: {
      email,
      success,
      reason,
      userId: userId ?? null,
      ip: info?.ip ?? null,
      userAgent: info?.userAgent ?? null,
    },
  }).catch((err) => console.error("loginLog error:", err))
}

/**
 * L'adapter Prisma d'Auth.js suppose son schéma User de référence (colonne
 * `image`, `emailVerified` DateTime). Le modèle Gleba diverge : pas d'image,
 * `emailVerified` booléen, champs `role`/`active`/`password`. On surcharge
 * donc les méthodes qui écrivent des lignes pour contrôler exactement les
 * champs envoyés à Prisma — sans surcharge, la première connexion Google
 * planterait sur un champ inconnu.
 */
export function glebaAdapter(): Adapter {
  const base = PrismaAdapter(prisma)
  return {
    ...base,
    // Pendant un callback OAuth en stratégie JWT, Auth.js résout l'utilisateur
    // de la session courante via getUser(sub) : s'il existe, l'identité Google
    // entrante lui est LIÉE au lieu de créer/retrouver le compte du visiteur.
    // La session démo étant partagée par tous les visiteurs du site public,
    // y répondre rattacherait leur identité Google au compte démo (incident
    // du 2026-07-31 : 28 connexions d'un utilisateur réel ont atterri sur la
    // démo). Répondre null = « personne n'est connecté » : le visiteur en
    // session démo qui clique « Continuer avec Google » obtient son propre
    // compte, et la démo ne peut capturer aucune identité.
    async getUser(id: string) {
      const user = await prisma.user.findUnique({ where: { id } })
      if (!user || estEmailDemo(user.email)) return null
      return { ...user, emailVerified: user.emailVerified ? new Date() : null }
    },
    // Création d'un compte à la volée lors d'une première connexion Google.
    // L'adresse est déjà contrôlée `email_verified` par le callback signIn :
    // le compte naît vérifié, sans passer par l'email de vérification.
    async createUser(data: AdapterUser) {
      const user = await prisma.user.create({
        data: {
          email: data.email.toLowerCase().trim(),
          name: data.name?.trim() || null,
          password: null,
          role: "USER",
          active: true,
          emailVerified: true,
        },
      })
      // Données d'exemple + emails de bienvenue : import dynamique pour tenir
      // nodemailer hors du bundle du middleware, qui importe ce fichier.
      const { initialiserCompteGoogle } = await import("./auth-google-onboarding")
      initialiserCompteGoogle({ id: user.id, email: user.email, name: user.name }).catch(
        (err) => console.error("initialiserCompteGoogle error:", err)
      )
      return { ...user, emailVerified: user.emailVerified ? new Date() : null }
    },
    // Le rattachement par email doit matcher l'email normalisé stocké en base.
    async getUserByEmail(email: string) {
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() },
      })
      if (!user) return null
      return { ...user, emailVerified: user.emailVerified ? new Date() : null }
    },
    // Liste blanche des champs : certains providers renvoient des clés hors
    // schéma Account (ex. refresh_token_expires_in) que Prisma rejetterait.
    async linkAccount(account: AdapterAccount) {
      // Verrou de fond, quel que soit le flux Auth.js qui mène ici : aucune
      // identité OAuth ne doit jamais être rattachée au compte démo partagé.
      const cible = await prisma.user.findUnique({
        where: { id: account.userId },
        select: { email: true },
      })
      if (cible && estEmailDemo(cible.email)) {
        throw new Error("Liaison OAuth refusée : compte de démonstration")
      }
      await prisma.account.create({
        data: {
          userId: account.userId,
          type: account.type,
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          refresh_token: (account.refresh_token as string | undefined) ?? null,
          access_token: (account.access_token as string | undefined) ?? null,
          expires_at: (account.expires_at as number | undefined) ?? null,
          token_type: (account.token_type as string | undefined) ?? null,
          scope: (account.scope as string | undefined) ?? null,
          id_token: (account.id_token as string | undefined) ?? null,
          session_state: (account.session_state as string | undefined) ?? null,
        },
      })
      return account
    },
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: glebaAdapter(),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) {
          throw new RefusConnexion(REFUS_CONNEXION.CHAMPS_MANQUANTS)
        }

        const email = credentials.email as string
        const info = clientInfo(request as Request | undefined)

        const user = await prisma.user.findUnique({
          where: { email },
        })

        if (!user) {
          logLogin(email, false, "not_found", undefined, info)
          throw new RefusConnexion(REFUS_CONNEXION.IDENTIFIANTS)
        }

        if (!user.active) {
          logLogin(email, false, "inactive", user.id, info)
          throw new RefusConnexion(REFUS_CONNEXION.COMPTE_DESACTIVE)
        }

        if (!user.emailVerified) {
          logLogin(email, false, "email_not_verified", user.id, info)
          throw new RefusConnexion(REFUS_CONNEXION.EMAIL_NON_VERIFIE)
        }

        // Compte créé via Google, sans mot de passe local : la connexion par
        // mot de passe est impossible tant qu'il n'en a pas défini un.
        if (!user.password) {
          logLogin(email, false, "no_password", user.id, info)
          throw new RefusConnexion(REFUS_CONNEXION.COMPTE_GOOGLE)
        }

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.password
        )

        if (!passwordMatch) {
          logLogin(email, false, "bad_password", user.id, info)
          throw new RefusConnexion(REFUS_CONNEXION.IDENTIFIANTS)
        }

        logLogin(email, true, "ok", user.id, info)

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      },
    }),
    // Consultation admin lecture seule : un jeton one-time émis par un admin
    // ouvre une session (dans une fenêtre privée) comme l'utilisateur cible.
    // La session porte `impersonatedBy` → le middleware impose la lecture seule.
    Credentials({
      id: "impersonation",
      name: "impersonation",
      credentials: { token: { label: "Token", type: "text" } },
      async authorize(credentials, request) {
        const raw = credentials?.token as string | undefined
        if (!raw) return null
        const info = clientInfo(request as Request | undefined)

        const grant = await prisma.impersonationGrant.findUnique({
          where: { tokenHash: await hashJeton(raw) },
        })
        // Jeton inconnu, déjà consommé (usage unique) ou expiré → refus.
        if (!grant || grant.consumedAt || grant.expiresAt.getTime() < Date.now()) return null

        const [admin, target] = await Promise.all([
          prisma.user.findUnique({ where: { id: grant.adminId }, select: { role: true } }),
          prisma.user.findUnique({
            where: { id: grant.targetId },
            select: { id: true, email: true, name: true, role: true, active: true },
          }),
        ])
        // L'émetteur doit toujours être admin, la cible doit exister et être active.
        if (admin?.role !== "ADMIN") return null
        if (!target || !target.active) return null

        // Usage unique atomique : une seule requête concurrente peut obtenir
        // la transition consumedAt NULL → date courante.
        const consomme = await consommerJetonImpersonation(prisma, grant.id)
        if (!consomme) return null
        logLogin(target.email, true, "impersonation", target.id, info)

        return {
          id: target.id,
          email: target.email,
          name: target.name,
          role: target.role,
          impersonatedBy: grant.adminId,
        }
      },
    }),
    // Connexion Google : activée seulement si le client OAuth est configuré
    // (AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET, lus automatiquement par Auth.js).
    ...(googleAuthDisponible()
      ? [
          Google({
            // Un membre inscrit par email peut se connecter avec Google sur la
            // même adresse : le callback signIn exige un email vérifié par
            // Google, le rattachement automatique est donc sûr.
            allowDangerousEmailAccountLinking: true,
            // Toujours afficher le sélecteur de compte Google. Sans cela,
            // Google reconnecte silencieusement la session en cours : un
            // utilisateur qui se déconnectait pour changer de compte
            // retombait systématiquement sur le même compte, sans écran.
            authorization: { params: { prompt: "select_account" } },
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      // Les deux providers Credentials font leurs contrôles et leur
      // journalisation dans authorize().
      if (account?.provider !== "google") return true

      const email = profile?.email?.toLowerCase().trim() || null
      const existant = email
        ? await prisma.user.findUnique({
            where: { email },
            select: { id: true, active: true },
          })
        : null
      const motif = motifRefusConnexionGoogle(profile ?? undefined, existant)
      if (motif) {
        logLogin(email ?? "google:email-manquant", false, `google_${motif}`, existant?.id)
        return `/login?error=${motif === "compte_inactif" ? "inactive" : "google"}`
      }
      return true
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        // null (pas undefined) pour bien RÉINITIALISER sur une connexion normale.
        token.impersonatedBy = (user as { impersonatedBy?: string | null }).impersonatedBy ?? null
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.impersonatedBy = (token.impersonatedBy as string | null) ?? null
      }
      return session
    },
  },
  events: {
    // Succès Google journalisé ici (et non dans le callback signIn) : pour un
    // nouveau compte, `user` y est la ligne créée en base, avec le bon id.
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email && user.id) {
        logLogin(user.email, true, "ok", user.id)
      }
    },
  },
})

// Types pour étendre les types NextAuth
declare module "next-auth" {
  interface User {
    role?: string
    /** Id de l'admin qui consulte, si session d'impersonation (lecture seule). */
    impersonatedBy?: string | null
  }
  interface Session {
    user: {
      /**
       * TENANT : exploitation dont on lit et écrit les données. Pour une session
       * rendue par `requireAuth`/`requireAuthApi`, c'est l'id du PROPRIÉTAIRE de
       * l'exploitation, qui peut différer de la personne connectée (cf.
       * `src/lib/exploitation/roles.ts`). Sur une session brute (`auth()`),
       * c'est l'acteur.
       */
      id: string
      email: string
      name?: string | null
      role: string
      impersonatedBy?: string | null
      /** ACTEUR : personne réellement connectée. Identité et attribution. */
      acteurId?: string
      /** Rôle de l'acteur dans l'exploitation courante. */
      roleExploitation?: "PROPRIETAIRE" | "MEMBRE" | "CONSULTATION"
      /** Modules autorisés ; `null` = aucune restriction. */
      modulesExploitation?: string[] | null
      estProprietaireExploitation?: boolean
      peutEcrireExploitation?: boolean
    }
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string
    role?: string
    impersonatedBy?: string | null
  }
}
