/**
 * Ordre de la saisie de récolte : les cultures prêtes à récolter d'abord
 * (date de récolte à ±14 jours du jour demandé), puis par date de récolte
 * croissante, les cultures sans date en dernier.
 *
 * L'ordre se calcule sur TOUTES les cultures en cours avant de découper la
 * page : trié page par page, il laissait en page 2 les cultures les plus
 * anciennes, souvent mûres, dès qu'une ferme dépassait une page.
 */
import { jourCivilStocke } from '@/lib/jour-civil'

export const FENETRE_PRETE_JOURS = 14

const MS_JOUR = 86_400_000

type DateStockee = Date | string | null | undefined

/** Jours entre le jour demandé et la date de récolte ; `null` sans date lisible. */
export function ecartJoursRecolte(dateRecolte: DateStockee, jour: string): number | null {
  const recolte = jourCivilStocke(dateRecolte)
  if (!recolte) return null
  return Math.round((Date.parse(`${recolte}T00:00:00Z`) - Date.parse(`${jour}T00:00:00Z`)) / MS_JOUR)
}

export function estPreteARecolter(dateRecolte: DateStockee, jour: string): boolean {
  const ecart = ecartJoursRecolte(dateRecolte, jour)
  return ecart != null && Math.abs(ecart) <= FENETRE_PRETE_JOURS
}

export function ordonnerPourSaisieRecolte<T extends { id: number; dateRecolte: DateStockee }>(
  cultures: readonly T[],
  jour: string,
): T[] {
  const lignes = cultures.map((culture) => {
    const ecart = ecartJoursRecolte(culture.dateRecolte, jour)
    return { culture, ecart, prete: ecart != null && Math.abs(ecart) <= FENETRE_PRETE_JOURS }
  })
  lignes.sort((a, b) => {
    if (a.prete !== b.prete) return a.prete ? -1 : 1
    if (a.ecart != null && b.ecart != null && a.ecart !== b.ecart) return a.ecart - b.ecart
    if ((a.ecart == null) !== (b.ecart == null)) return a.ecart == null ? 1 : -1
    return b.culture.id - a.culture.id
  })
  return lignes.map((ligne) => ligne.culture)
}
