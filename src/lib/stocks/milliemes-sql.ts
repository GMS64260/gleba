import { Prisma } from '@prisma/client'
import { CODE_RETOUR_EXCEDENT, DECIMALES_STOCK, MESSAGE_RETOUR_EXCEDENT, quantiteCanonique } from './milliemes'
import { ErreurCommerciale } from '@/lib/commercial/regles'

/**
 * Pendants SQL de `milliemes.ts` : l'UPDATE reste une seule instruction
 * atomique (la valeur est relue sous le verrou de ligne), mais le calcul se
 * fait en `numeric` exact au lieu d'une soustraction de flottants.
 *
 * `CAST(float8 AS numeric)` garde 15 chiffres significatifs, puis l'arrondi à
 * la grille (10⁻⁹) efface un résidu flottant hérité (0,09999999999999998,
 * −2·10⁻¹⁶) sans migration de données, et sans arrondir une production plus
 * précise que le millième (2,3005 kg reste 2,3005 kg).
 *
 * La quantité est toujours positive : une sortie la soustrait, un retour
 * l'ajoute, avec le même littéral décimal. Les deux sont donc inverses.
 */

/** La colonne (ou l'expression) de stock lue normalisée, en `numeric`. NULL reste NULL. */
export function sqlStockNormalise(stock: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`ROUND(CAST(${stock} AS numeric), ${Prisma.raw(String(DECIMALES_STOCK))})`
}

/** La quantité canonique du mouvement, en `numeric` exact (même valeur que `quantiteCanonique`). */
function sqlQuantite(quantite: number): Prisma.Sql {
  if (!Number.isFinite(quantite)) throw new Error('Quantité de stock invalide.')
  return Prisma.sql`CAST(${quantiteCanonique(quantite).toFixed(DECIMALES_STOCK)} AS numeric)`
}

/** Valeur à écrire après une sortie. NULL (stock non suivi) reste NULL. */
export function sqlStockApresSortie(stock: Prisma.Sql, quantite: number): Prisma.Sql {
  return Prisma.sql`CAST(${sqlStockNormalise(stock)} - ${sqlQuantite(quantite)} AS double precision)`
}

/**
 * Valeur à écrire après un retour. NULL (stock non suivi ou jamais entamé) reste NULL.
 *
 * Avec un `plafond` (la production du lot, colonne brute), même règle que
 * `plafonnerStock` : un reliquat qui dépasse la production BRUTE d'au plus
 * 10⁻⁹ vaut la production brute (une production héritée de 2,0999999999999996
 * livrée de 0,1 revient à sa valeur brute, sans refus de la contrainte CHECK
 * `stock <= production`) ; au-delà, l'instruction échoue avec
 * `STOCK_RETOUR_EXCEDENT` (arbitrage du 2026-11-15, contre-revue ADV259 : aucun
 * plafonnement silencieux d'un excédent réel, seuil mesuré sur la production
 * brute et non sur sa lecture arrondie à la grille).
 *
 * Le plafond est la fonction SQL `stock_apres_retour_plafonne` (migrations
 * 20261115130000 puis 20261115180000) : la même primitive borne le retrait
 * d'un produit de la boutique vers sa récolte (trigger `source_recolte_boutique`).
 * Une seule définition du plafond pour toutes les restitutions.
 */
export function sqlStockApresRetour(stock: Prisma.Sql, quantite: number, plafond?: Prisma.Sql): Prisma.Sql {
  const apres = Prisma.sql`(${sqlStockNormalise(stock)} + ${sqlQuantite(quantite)})`
  if (!plafond) return Prisma.sql`CAST(${apres} AS double precision)`
  return Prisma.sql`stock_apres_retour_plafonne(${apres}, CAST(${plafond} AS double precision))`
}

/** Condition « le stock couvre la quantité », comparée sur la grille. */
export function sqlStockCouvre(stock: Prisma.Sql, quantite: number): Prisma.Sql {
  return Prisma.sql`${sqlStockNormalise(stock)} >= ${sqlQuantite(quantite)}`
}

/**
 * Débit (`sortie`) ou restitution (`retour`) d'un produit de la boutique à
 * stock suivi, sans condition de suffisance : une seule instruction, donc les
 * mouvements concurrents se cumulent comme avec `increment`/`decrement`.
 * Renvoie le stock après mouvement (null : stock illimité, inchangé).
 */
export async function mouvoirStockBoutique(tx: Prisma.TransactionClient, produitId: number, sens: 'sortie' | 'retour', quantite: number): Promise<number | null> {
  const STOCK = Prisma.sql`stock_dispo`
  const apres = sens === 'sortie' ? sqlStockApresSortie(STOCK, quantite) : sqlStockApresRetour(STOCK, quantite)
  const lignes = await tx.$queryRaw<Array<{ stock_dispo: number | null }>>`UPDATE produits_boutique SET stock_dispo = ${apres}, updated_at = CURRENT_TIMESTAMP WHERE id = ${produitId} RETURNING stock_dispo`
  if (!lignes.length) throw new Error(`Produit de la boutique ${produitId} introuvable.`)
  return lignes[0].stock_dispo
}

/** Lots dont le reliquat commercial est plafonné par la production (contraintes CHECK `stock <= production`). */
export type LotPlafonne = 'recolte' | 'fruit' | 'bois' | 'transforme'
const LOTS_PLAFONNES: Record<LotPlafonne, { table: Prisma.Sql; production: Prisma.Sql; horodatage: Prisma.Sql }> = {
  recolte: { table: Prisma.sql`recoltes`, production: Prisma.sql`quantite`, horodatage: Prisma.empty },
  fruit: { table: Prisma.sql`recoltes_arbres`, production: Prisma.sql`quantite`, horodatage: Prisma.empty },
  // Même expression que `quantiteBois` et que la contrainte `bois_stock_commercial_check`.
  bois: { table: Prisma.sql`production_bois`, production: Prisma.sql`COALESCE(volume_stere, volume_m3, poids_kg, 0)`, horodatage: Prisma.empty },
  transforme: { table: Prisma.sql`lots_transformes`, production: Prisma.sql`quantite`, horodatage: Prisma.sql`, updated_at = CURRENT_TIMESTAMP` },
}
/** Écart sous lequel un reliquat revenu à la production rend le lot « jamais entamé ». */
const TOLERANCE_LIBERATION = '0.000001'

/**
 * Le seul chemin qui rend du stock à un lot plafonné (retour de BL, de facture
 * ou de caisse, annulation d'une perte, d'un usage interne ou d'une
 * transformation). Le plafond est la production lue **dans la même
 * instruction, sur la colonne brute** : jamais une valeur relue par le modèle
 * Prisma, qui arrondit le float8 à 15 chiffres (2,0999999999999996 relu 2,1).
 * Écrire 2,1 sous ce plafond relu était refusé par la contrainte CHECK
 * (23514, contre-revue ADV45). La règle de plafonnement est celle de
 * `plafonnerStock` : un reliquat qui dépasse la production brute d'au plus
 * 10⁻⁹ vaut la production brute ; au-delà, le retour est refusé par une
 * `ErreurCommerciale` (409) lisible, et la transaction de l'appelant est
 * annulée (stock et journal inchangés).
 *
 * - `jamaisEntameVautProduction` : un reliquat NULL part de la production
 *   (sorties physiques du verger) ; sinon NULL reste NULL (retours commerciaux,
 *   un lot jamais entamé n'a rien à recevoir).
 * - `liberer` : plus aucun mouvement sur le lot ; un reliquat revenu à la
 *   production redevient NULL, comme avant la première sortie.
 *
 * Renvoie le nombre de lignes modifiées (0 : lot absent de ce compte).
 */
export async function restituerAuLot(tx: Prisma.TransactionClient, userId: string, type: LotPlafonne, id: number, quantite: number,
  options: { jamaisEntameVautProduction?: boolean; liberer?: boolean } = {}): Promise<number> {
  const { table, production, horodatage } = LOTS_PLAFONNES[type]
  const stock = options.jamaisEntameVautProduction ? Prisma.sql`COALESCE(stock_disponible_commercial, ${production})` : Prisma.sql`stock_disponible_commercial`
  // Pas de GREATEST(0, …) : il changerait un NULL en 0. Le reliquat est ≥ 0 (CHECK) et la quantité ajoutée est positive.
  const apres = sqlStockApresRetour(stock, quantite, production)
  const valeur = options.liberer
    ? Prisma.sql`CASE WHEN ABS(${apres} - ${production}) <= ${Prisma.raw(TOLERANCE_LIBERATION)} THEN NULL ELSE ${apres} END`
    : apres
  try {
    return await tx.$executeRaw`UPDATE ${table} SET stock_disponible_commercial = ${valeur}${horodatage} WHERE id = ${id} AND user_id = ${userId}`
  } catch (erreur) {
    throw traduireRetourExcedent(erreur)
  }
}

/**
 * `STOCK_RETOUR_EXCEDENT` (SQL ou `plafonnerStock`) devient une
 * `ErreurCommerciale` 409 au message lisible (`MESSAGE_RETOUR_EXCEDENT`, le
 * même que `messageConflitStockCaisse`) ; toute autre erreur est rendue telle quelle.
 */
export function traduireRetourExcedent(erreur: unknown): unknown {
  if (!(erreur instanceof Error) || !erreur.message.includes(CODE_RETOUR_EXCEDENT)) return erreur
  return new ErreurCommerciale(MESSAGE_RETOUR_EXCEDENT, 409)
}
