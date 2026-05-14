/**
 * Configuration NextAuth.js v5 (Auth.js)
 */

import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import bcrypt from "bcryptjs"
import prisma from "./prisma"

/** Log une tentative de connexion (fire-and-forget) */
function logLogin(email: string, success: boolean, reason: string, userId?: string) {
  prisma.loginLog.create({
    data: { email, success, reason, userId: userId ?? null },
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
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email et mot de passe requis")
        }

        const email = credentials.email as string

        const user = await prisma.user.findUnique({
          where: { email },
        })

        if (!user) {
          logLogin(email, false, "not_found")
          throw new Error("Identifiants invalides")
        }

        if (!user.active) {
          logLogin(email, false, "inactive", user.id)
          throw new Error("Compte désactivé")
        }

        if (!user.emailVerified) {
          logLogin(email, false, "email_not_verified", user.id)
          throw new Error("Email non vérifié. Consultez votre boîte mail.")
        }

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.password
        )

        if (!passwordMatch) {
          logLogin(email, false, "bad_password", user.id)
          throw new Error("Identifiants invalides")
        }

        logLogin(email, true, "ok", user.id)

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
