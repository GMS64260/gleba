/**
 * Configuration NextAuth.js v5 (Auth.js)
 */

import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import bcrypt from "bcryptjs"
import prisma from "./prisma"

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

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
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
          throw new Error("Email et mot de passe requis")
        }

        const email = credentials.email as string
        const info = clientInfo(request as Request | undefined)

        const user = await prisma.user.findUnique({
          where: { email },
        })

        if (!user) {
          logLogin(email, false, "not_found", undefined, info)
          throw new Error("Identifiants invalides")
        }

        if (!user.active) {
          logLogin(email, false, "inactive", user.id, info)
          throw new Error("Compte désactivé")
        }

        if (!user.emailVerified) {
          logLogin(email, false, "email_not_verified", user.id, info)
          throw new Error("Email non vérifié. Consultez votre boîte mail.")
        }

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.password
        )

        if (!passwordMatch) {
          logLogin(email, false, "bad_password", user.id, info)
          throw new Error("Identifiants invalides")
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
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session
    },
  },
})

// Types pour étendre les types NextAuth
declare module "next-auth" {
  interface User {
    role?: string
  }
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      role: string
    }
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string
    role?: string
  }
}
