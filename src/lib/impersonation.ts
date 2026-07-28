/**
 * Consultation admin lecture seule — jetons d'impersonation.
 *
 * Un admin génère un jeton one-time (endpoint /api/admin/impersonate) qu'il
 * ouvre dans une fenêtre de navigation privée : cette fenêtre est alors
 * connectée comme l'utilisateur cible (via le provider NextAuth "impersonation"),
 * sans écraser la session admin de la fenêtre normale. Le middleware impose la
 * lecture seule (aucune écriture, pas d'accès /admin) tant que la session porte
 * `impersonatedBy`.
 *
 * On ne stocke JAMAIS le jeton brut : seulement son hash SHA-256.
 */

/** Durée de validité d'un jeton : court, car sensible. */
export const IMPERSONATION_TTL_MS = 2 * 60 * 1000

export function genererJetonImpersonation(): string {
  const octets = new Uint8Array(32)
  globalThis.crypto.getRandomValues(octets)
  return Array.from(octets, (octet) => octet.toString(16).padStart(2, "0")).join("")
}

export async function hashJeton(raw: string): Promise<string> {
  const empreinte = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(raw),
  )
  return Array.from(new Uint8Array(empreinte), (octet) =>
    octet.toString(16).padStart(2, "0")
  ).join("")
}

type ClientConsommationJeton = {
  impersonationGrant: {
    updateMany: (args: {
      where: {
        id: string
        consumedAt: null
        expiresAt: { gt: Date }
      }
      data: { consumedAt: Date }
    }) => Promise<{ count: number }>
  }
}

/**
 * Consomme un jeton par une mise à jour conditionnelle unique. Deux requêtes
 * concurrentes peuvent lire le même grant, mais une seule obtiendra count=1.
 */
export async function consommerJetonImpersonation(
  client: ClientConsommationJeton,
  grantId: string,
  maintenant = new Date(),
): Promise<boolean> {
  const resultat = await client.impersonationGrant.updateMany({
    where: {
      id: grantId,
      consumedAt: null,
      expiresAt: { gt: maintenant },
    },
    data: { consumedAt: maintenant },
  })
  return resultat.count === 1
}
