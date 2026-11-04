/**
 * QA 2026-05-15 — Bug #11 : une dépense nommant un fournisseur connu du
 * référentiel n'y était pas rattachée. Le rattachement se fait par nom
 * normalisé ; la création automatique a été retirée le 2026-11-04 (voir
 * ci-dessous).
 */

import type { Prisma, PrismaClient } from "@prisma/client"
import prisma from "@/lib/prisma"

type Tx = PrismaClient | Prisma.TransactionClient

export interface EnsureFournisseurInput {
  /** Si déjà connu, on respecte le choix utilisateur. */
  fournisseurId?: string | null
  /** Nom (peut tomber du formulaire dépense rapide). */
  nom?: string | null
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
 * Rattache une dépense à une fiche EXISTANTE du référentiel des fournisseurs.
 * Renvoie l'`id` de la fiche, ou null : le nom saisi reste alors porté par la
 * dépense (`fournisseurNom`).
 *
 * La table `fournisseurs` est globale (PK = id texte, pas de colonne
 * `user_id`) : toute fiche y est visible de toutes les exploitations. Jusqu'au
 * 2026-11-04, un nom tapé dans une dépense créait une fiche (« Jean Martin,
 * voisin, foin »), que la liste des fournisseurs et les exports montraient
 * ensuite à tous les comptes. On ne crée donc plus rien ici : le référentiel
 * reste celui de l'administration, et une fiche propre à chaque exploitation
 * demandera une colonne de propriétaire (revue du 2026-11-04).
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
  return match?.id ?? null
}
