import { Prisma } from '@prisma/client'
import type { Devise } from '@/lib/territoires'
import { schemaContexteFiscal } from './schema-contexte-fiscal'

/*
 * Devise d'une vente manuelle (hors facture) : celle de son contexte fiscal figé.
 *
 * Frontière public/privé : ce module est PUBLIC et ne dépend que de modules
 * publics. La colonne `VenteManuelle.contexteFiscal` n'existe que dans le schéma
 * de la zone privée ; aucun appelant public ne la nomme donc dans son code :
 * - `SELECT_CONTEXTE_FISCAL_VENTE` l'ajoute à un `select` quand le client Prisma
 *   généré la connaît (arbre complet), et vaut `{}` sinon (dépôt public seul) ;
 * - `monnaieVente` la lit sur la ligne si elle y figure.
 * Dans le dépôt public seul, aucune vente n'a de contexte figé : sa devise est la
 * devise courante de l'exploitation, comme pour une vente ancienne.
 */

const scalaires = (Prisma as { VenteManuelleScalarFieldEnum?: Record<string, string> } | undefined)?.VenteManuelleScalarFieldEnum

/** Le client Prisma généré expose-t-il la colonne du contexte fiscal figé ? */
export const CONTEXTE_FISCAL_VENTE_DISPONIBLE = !!scalaires && Object.prototype.hasOwnProperty.call(scalaires, 'contexteFiscal')

/**
 * Fragment de `select` d'une `VenteManuelle` qui charge son contexte fiscal figé
 * quand la colonne existe. Typé `object` : le type de la ligne n'en dépend pas, la
 * lecture passe par `monnaieVente`. Inutile sans `select` (tous les scalaires).
 */
export const SELECT_CONTEXTE_FISCAL_VENTE: object = CONTEXTE_FISCAL_VENTE_DISPONIBLE ? { contexteFiscal: true } : {}

/**
 * Devise d'une vente hors facture, lue sur sa ligne :
 * - pas de contexte figé (vente ancienne, ou dépôt sans la colonne) : la devise
 *   courante passée par l'appelant ;
 * - contexte fiscal figé entièrement valide : sa devise ;
 * - contexte présent mais illisible : `null` (« devise historique inconnue »),
 *   jamais la devise courante.
 * Seul lecteur pour la ligne et les totaux de Transactions (GET revenus), la
 * répartition par source (GET sources) et les créances Impayées (GET
 * ventes-manuelles, `chargerEncoursCompta`).
 */
export function monnaieVente(vente: object, deviseCourante: Devise | null): Devise | null {
  const contexte = (vente as { contexteFiscal?: unknown }).contexteFiscal
  if (contexte == null) return deviseCourante
  const resultat = schemaContexteFiscal.safeParse(contexte)
  return resultat.success ? resultat.data.devise : null
}

/** Devise d’une commande : contexte figé s’il existe, sinon devise courante. */
export function monnaieCommande(commande: object, deviseCourante: Devise | null): Devise | null {
  const snapshot = (commande as { fiscaliteSnapshot?: unknown }).fiscaliteSnapshot
  if (snapshot == null) return deviseCourante
  if (typeof snapshot !== 'object' || Array.isArray(snapshot)) return null
  const { version, regimeTva, territoire, devise, date } = snapshot as Record<string, unknown>
  return monnaieVente({ contexteFiscal: { version, regimeTva, territoire, devise, date } }, deviseCourante)
}
