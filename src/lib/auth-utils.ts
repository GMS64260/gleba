/**
 * Utilitaires d'authentification
 */

import { auth } from "./auth"
import { redirect } from "next/navigation"
import { NextResponse } from "next/server"
import { checkRateLimit, getClientIP } from "./rate-limit"

/**
 * Récupère la session courante (Server Component)
 */
export async function getSession() {
  return await auth()
}

/**
 * Vérifie l'authentification - redirige vers login si non connecté
 * Pour utilisation dans les Server Components/Pages
 */
export async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }
  return session
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
export async function requireAuthApi(request?: Request) {
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
  return { error: null, session }
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
 * Extrait l'ID utilisateur de la session
 */
export function getUserId(session: { user: { id: string } } | null): string {
  if (!session?.user?.id) {
    throw new Error("Session invalide")
  }
  return session.user.id
}
