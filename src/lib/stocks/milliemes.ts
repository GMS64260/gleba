/**
 * Arithmétique décimale exacte du stock commercial.
 *
 * Les stocks sont des `Float` : 2,3 − 0,5 − 1,8 y vaut −2,2·10⁻¹⁶, ce qui
 * affichait un stock négatif et refusait ou alertait à tort. Toute addition
 * ou soustraction de stock passe par des entiers sur une grille décimale.
 *
 * Règle (tour 2, 2026-11-14) :
 * - la grille est le milliardième (10⁻⁹), pas le millième : une quantité
 *   saisie au millième donne un stock au millième, mais une production ou un
 *   document historique plus précis (2,3005 kg, 0,0004 kg) n'est jamais
 *   arrondi. Arrondir le reliquat au millième créait du stock (2,3005 → 2,301
 *   au retour) ou ne débitait rien (0,0004 → 0) ;
 * - la quantité d'un mouvement est sa valeur absolue sur cette grille
 *   (`quantiteCanonique`) : le débit, la trace et le retour utilisent la même,
 *   donc sortie et retour sont exactement inverses ;
 * - une valeur lue à un résidu flottant près (±10⁻⁹) est lue normalisée, sans
 *   migration de données ;
 * - le plafond d'un lot (sa production, brute en base) suit la même grille :
 *   un reliquat qui la dépasse (production brute) d'au plus 10⁻⁹ vaut la
 *   production brute ; au-delà le retour est refusé (`plafonnerStock`,
 *   `STOCK_RETOUR_EXCEDENT`).
 *
 * Module pur (aucun import serveur) : utilisable aussi côté navigateur. Les
 * fragments SQL équivalents sont dans `milliemes-sql.ts`.
 */
export const DECIMALES_STOCK = 9
const GRILLE = 10 ** DECIMALES_STOCK

/** Entier signé sur la grille ; l'arrondi porte sur la valeur absolue (symétrique), jamais de zéro négatif. */
function surGrille(valeur: number): number {
  return (Math.sign(valeur) * Math.round(Math.abs(valeur) * GRILLE)) || 0
}

/** Le stock lu normalisé (0,09999999999999998 → 0,1 ; −2·10⁻¹⁶ → 0 ; 2,3005 reste 2,3005). */
export function normaliserStock(stock: number): number {
  return surGrille(stock) / GRILLE
}

/**
 * La quantité positive réellement déplacée par un mouvement : la même pour la
 * garde, le débit, la trace et le retour. 0 si la saisie est sous la grille.
 */
export function quantiteCanonique(quantite: number): number {
  return surGrille(Math.abs(quantite)) / GRILLE
}

/** stock + quantité rendue (quantité canonique, toujours ajoutée). */
export function ajouterAuStock(stock: number, quantite: number): number {
  return (surGrille(stock) + surGrille(Math.abs(quantite))) / GRILLE
}

/** stock − quantité sortie (quantité canonique, toujours retirée). */
export function retirerDuStock(stock: number, quantite: number): number {
  return (surGrille(stock) - surGrille(Math.abs(quantite))) / GRILLE
}

/** Préfixe de l'erreur levée (TypeScript et SQL) quand un retour dépasse la production du lot. */
export const CODE_RETOUR_EXCEDENT = 'STOCK_RETOUR_EXCEDENT'

/**
 * Message lisible de `STOCK_RETOUR_EXCEDENT`, pour toutes les surfaces (retours
 * commerciaux, verger, caisse). Il vit ici, module public, pour que
 * `milliemes-sql.ts` (public) ne dépende pas de `@/lib/caisse` (zone privée).
 */
export const MESSAGE_RETOUR_EXCEDENT = 'Le retour dépasse la production du lot : son stock disponible ne peut pas excéder la quantité produite. Vérifiez les sorties et les retours déjà enregistrés sur ce lot.'

/**
 * Le reliquat d'un lot plafonné par sa production (contrainte CHECK
 * `stock <= production`). La production d'un lot hérité peut porter un résidu
 * flottant (0,7 × 3 = 2,0999999999999996) ou plus de neuf décimales
 * (2,3000000006) : lue sur la grille, elle vaut 2,1 ou 2,300000001, au-dessus
 * de sa valeur brute. Règle (arbitrage du 2026-11-15, contre-revue ADV259 ;
 * même règle en SQL : `stock_apres_retour_plafonne`, migration 20261115180000),
 * le refus se mesure sur la production BRUTE, jamais sur sa lecture arrondie :
 * - au-dessus de la production brute de plus de 10⁻⁹ (reliquat − 10⁻⁹ >
 *   production) : erreur `STOCK_RETOUR_EXCEDENT`, aucun plafonnement
 *   silencieux (le retour rendrait plus que ce qui a été produit) ;
 * - sinon, reliquat qui atteint la production lue sur la grille (retour
 *   intégral) ou qui la dépasse : la production brute, le lot retrouve
 *   exactement son état d'avant la sortie (sans dépasser la CHECK ni perdre la
 *   fraction historique d'une production arrondie vers le bas, 2,3000000004) ;
 * - sinon : le reliquat normalisé, strictement sous la production.
 * Le refus se compare en flottants : le reliquat est un entier de la grille
 * divisé par 10⁹ (arrondi au plus proche, comme le CAST numeric → float8 de
 * PostgreSQL) et la production y est exacte.
 */
export function plafonnerStock(stock: number, production: number): number {
  const reliquat = surGrille(stock)
  const valeur = reliquat / GRILLE
  if ((reliquat - 1) / GRILLE > production) {
    throw new Error(`${CODE_RETOUR_EXCEDENT}: le stock rendu (${valeur}) dépasserait la production du lot (${production}).`)
  }
  return reliquat >= surGrille(production) || valeur > production ? production : valeur
}

/** Vrai si le stock couvre la quantité, comparés sur la grille. */
export function stockCouvre(stock: number, quantite: number): boolean {
  return surGrille(stock) >= surGrille(Math.abs(quantite))
}

/**
 * Vrai pour un nombre entier et positif de millièmes. Le stock d'un produit de
 * la boutique est tenu en millièmes entiers par la base (journal de stock
 * physique, erreur `STOCK_PHYSIQUE_QUANTITE`) : ses mouvements se refusent en
 * amont, avec un message lisible, plutôt que par une erreur SQL.
 */
export function estAuMillieme(quantite: number): boolean {
  if (!Number.isFinite(quantite)) return false
  const milliemes = Math.round(quantite * 1000)
  return milliemes >= 1 && Math.abs(quantite * 1000 - milliemes) <= 1e-6
}
