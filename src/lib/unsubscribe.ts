/**
 * Gestion du désabonnement aux emails non transactionnels (campagnes feedback…).
 *
 * Chaque utilisateur a un `unsubscribeToken` stable (généré à la demande) qui
 * sert de lien de désabonnement en 1 clic, sans connexion. Les emails
 * transactionnels (vérification d'adresse, réinitialisation de mot de passe)
 * ne sont jamais soumis à l'opt-out.
 */

import prisma from "@/lib/prisma"

/**
 * 24 octets aléatoires en base64url via Web Crypto — pas le module Node
 * `crypto` : ce fichier est atteignable depuis le bundle edge du middleware
 * (auth.ts → onboarding Google) et Turbopack refuse les modules Node dans ce
 * graphe. Même précédent que l'impersonation.
 */
function tokenAleatoireBase64Url(octets: number): string {
  const buf = new Uint8Array(octets)
  globalThis.crypto.getRandomValues(buf)
  let bin = ""
  for (const b of buf) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

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

  const token = tokenAleatoireBase64Url(24)
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
