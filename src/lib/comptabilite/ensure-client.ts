/**
 * QA 2026-05-15 — Bug #6 : la fiche /comptabilite/clients restait
 * vide alors que 17+ clients distincts existaient dans Transactions,
 * Factures et Commandes boutique. Cause : le référentiel `Client`
 * n'était jamais hydraté automatiquement quand on créait une
 * VenteManuelle / Facture / CommandeBoutique avec juste un `clientNom`.
 *
 * Cette lib expose `ensureClientForUser` qui implémente une logique
 * "find or create" idempotente :
 *   1. Si un clientId est déjà passé → no-op, retourne l'id.
 *   2. Sinon, recherche par email (priorité) puis par nom normalisé.
 *   3. Si rien trouvé → crée un Client minimal (nom + email/téléphone
 *      si fournis) et retourne le nouvel id.
 *
 * L'objectif est de garantir que toute transaction nominative remonte
 * dans la fiche Clients sans saisie manuelle supplémentaire — pour le
 * compte 411 et les relances.
 */

import type { Prisma, PrismaClient } from "@prisma/client"
import prisma from "@/lib/prisma"

type Tx = PrismaClient | Prisma.TransactionClient

export interface EnsureClientInput {
  /** Si déjà connu, on respecte le choix utilisateur. */
  clientId?: number | null
  /** Nom commercial / particulier — obligatoire si pas de clientId. */
  nom?: string | null
  email?: string | null
  telephone?: string | null
  /** "particulier" (défaut) | "professionnel" | "association" | "amap" */
  type?: string
}

function normaliseNom(nom: string): string {
  return nom
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
}

/**
 * Find-or-create idempotent. Renvoie l'`id` du client trouvé/créé,
 * ou null si aucune donnée exploitable (pas de clientId, pas de nom).
 */
export async function ensureClientForUser(
  userId: string,
  input: EnsureClientInput,
  tx: Tx = prisma
): Promise<number | null> {
  if (input.clientId != null) {
    // On vérifie quand même l'appartenance pour éviter un orphelin
    // multi-tenant si un clientId externe est passé.
    const exists = await tx.client.findFirst({
      where: { id: input.clientId, userId },
      select: { id: true },
    })
    return exists?.id ?? null
  }

  const nom = input.nom?.trim()
  if (!nom) return null

  // Recherche par email d'abord (clé naturelle la plus fiable)
  if (input.email) {
    const byEmail = await tx.client.findFirst({
      where: { userId, email: input.email.trim().toLowerCase() },
      select: { id: true },
    })
    if (byEmail) return byEmail.id
  }

  // Fallback : nom normalisé (case-insensitive, accents-insensitive)
  const nomNormalise = normaliseNom(nom)
  const candidats = await tx.client.findMany({
    where: { userId },
    select: { id: true, nom: true },
  })
  const match = candidats.find((c) => normaliseNom(c.nom) === nomNormalise)
  if (match) return match.id

  // Création
  const created = await tx.client.create({
    data: {
      userId,
      nom,
      type: input.type ?? "particulier",
      email: input.email?.trim().toLowerCase() || null,
      telephone: input.telephone?.trim() || null,
      pays: "France",
      actif: true,
    },
    select: { id: true },
  })
  return created.id
}
