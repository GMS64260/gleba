/**
 * QA 2026-05-15 — Bug #11 : la fiche /comptabilite/fournisseurs ne
 * listait pas certains fournisseurs (Élevage local, Ferme du Coteau,
 * Couvoir de Cholet…) bien que présents en dépenses. Même remède que
 * pour les clients : find-or-create automatique côté backend.
 */

import type { Prisma, PrismaClient } from "@prisma/client"
import prisma from "@/lib/prisma"

type Tx = PrismaClient | Prisma.TransactionClient

export interface EnsureFournisseurInput {
  /** Si déjà connu, on respecte le choix utilisateur. */
  fournisseurId?: string | null
  /** Nom (peut tomber du formulaire dépense rapide). */
  nom?: string | null
  email?: string | null
  telephone?: string | null
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
 * Find-or-create idempotent. Renvoie l'`id` du fournisseur ou null
 * si aucune donnée exploitable.
 *
 * Note multi-tenant : la table `fournisseurs` est globale (PK = id
 * texte, pas de colonne `user_id`). On dédoublonne donc sur tout
 * le référentiel par nom normalisé — un fournisseur partagé bénéficie
 * à tous les tenants.
 */
export async function ensureFournisseurForUser(
  _userId: string,
  input: EnsureFournisseurInput,
  tx: Tx = prisma
): Promise<string | null> {
  if (input.fournisseurId) {
    const exists = await tx.fournisseur.findUnique({
      where: { id: input.fournisseurId },
      select: { id: true },
    })
    return exists?.id ?? null
  }

  const nom = input.nom?.trim()
  if (!nom) return null

  // Recherche existante par nom normalisé (case + accents-insensitive)
  const candidats = await tx.fournisseur.findMany({ select: { id: true } })
  const nomNormalise = normaliseNom(nom)
  const match = candidats.find((f) => normaliseNom(f.id) === nomNormalise)
  if (match) return match.id

  // Création — l'id est le nom brut (cf. convention seed : "Kokopelli",
  // "La Ferme de Sainte Marthe"…). Cap 100 chars pour sécurité.
  const id = nom.slice(0, 100)
  const created = await tx.fournisseur.create({
    data: {
      id,
      email: input.email?.trim().toLowerCase() || null,
      telephone: input.telephone?.trim() || null,
      actif: true,
    },
    select: { id: true },
  })
  return created.id
}
