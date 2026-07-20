/**
 * Gestion du désabonnement aux emails non transactionnels (campagnes feedback…).
 *
 * Chaque utilisateur a un `unsubscribeToken` stable (généré à la demande) qui
 * sert de lien de désabonnement en 1 clic, sans connexion. Les emails
 * transactionnels (vérification d'adresse, réinitialisation de mot de passe)
 * ne sont jamais soumis à l'opt-out.
 */

import { randomBytes } from "crypto"
import prisma from "@/lib/prisma"

export const MAIL_BASE_URL =
  process.env.FEEDBACK_BASE_URL || process.env.NEXTAUTH_URL || "https://gleba.fr"

/** URL publique de la page de désabonnement pour un token donné. */
export function unsubscribeUrl(token: string): string {
  return `${MAIL_BASE_URL.replace(/\/$/, "")}/desabonnement/${token}`
}

/** URL du handler POST one-click RFC 8058 (distincte de la page HTML). */
export function oneClickUnsubscribeUrl(token: string): string {
  return `${MAIL_BASE_URL.replace(/\/$/, "")}/api/desabonnement/${token}`
}

/**
 * Retourne le token de désabonnement de l'utilisateur, en le créant s'il
 * n'existe pas encore. Accepte un client transaction Prisma optionnel.
 */
export async function getOrCreateUnsubscribeToken(
  userId: string,
  client: { user: typeof prisma.user } = prisma,
): Promise<string> {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: { unsubscribeToken: true },
  })
  if (user?.unsubscribeToken) return user.unsubscribeToken

  const token = randomBytes(24).toString("base64url")
  await client.user.update({
    where: { id: userId },
    data: { unsubscribeToken: token },
  })
  return token
}

/** En-tête List-Unsubscribe (RFC 2369 / 8058) pour une bonne délivrabilité. */
export function listUnsubscribeHeaders(token: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${oneClickUnsubscribeUrl(token)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  }
}
