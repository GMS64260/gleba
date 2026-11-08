import type { Prisma } from '@prisma/client'

/**
 * Fiche fournisseur sans coordonnées bancaires.
 *
 * `Fournisseur` est une table GLOBALE, commune à tous les comptes. Ses champs
 * bancaires (IBAN, BIC, clé RIB), saisis par l'administration, ne sont montrés
 * qu'aux administrateurs par `GET /api/comptabilite/fournisseurs` (audit #42).
 * Les routes métier qui embarquaient la fiche entière (`fournisseur: true` sur
 * les variétés, les espèces et les aliments) et les exports de compte les
 * servaient pourtant à n'importe quel compte (revue du 2026-11-04). Toute
 * lecture d'une fiche fournisseur hors de l'administration passe par ici.
 */
export const CHAMPS_BANCAIRES_FOURNISSEUR = ['iban', 'bic', 'ribCle'] as const

export const SELECT_FOURNISSEUR_SANS_BANQUE = {
  id: true,
  contact: true,
  adresse: true,
  ville: true,
  codePostal: true,
  pays: true,
  email: true,
  telephone: true,
  siteWeb: true,
  siret: true,
  siren: true,
  tvaIntra: true,
  type: true,
  banqueNom: true,
  conditionsPaiement: true,
  notes: true,
  actif: true,
  createdAt: true,
} satisfies Prisma.FournisseurSelect

/** Retire les champs bancaires d'une fiche déjà lue (exports génériques). */
export function sansCoordonneesBancaires<T extends Record<string, unknown>>(fiche: T): Omit<T, 'iban' | 'bic' | 'ribCle'> {
  const copie: Record<string, unknown> = { ...fiche }
  for (const champ of CHAMPS_BANCAIRES_FOURNISSEUR) delete copie[champ]
  return copie as Omit<T, 'iban' | 'bic' | 'ribCle'>
}
