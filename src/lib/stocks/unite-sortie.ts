/**
 * Unité qu'affiche le formulaire de sortie de stock (Stocks > Consommations).
 *
 * QA cmvgef6ou, revue du 2026-10-20 : l'écran lisait la seule unité du stock
 * net (`stocksNet[espece].unite`, GET /api/consommations). Une espèce comptée
 * en tiges mais jamais récoltée ni inventoriée n'y a pas d'entrée : l'écran
 * affichait « kg », la route refusait « en tiges », et le rechargement
 * redonnait « kg ». Sans stock, l'unité est celle de l'espèce pour la ferme,
 * que `/api/especes` sert déjà (`appliquerSurcharges` : surcharge de la ferme,
 * sinon catalogue). Les deux dérivent de `rendementEffectif` puis
 * `uniteQuantiteRecolte`, comme `chargerUnitesStock` côté serveur
 * (`src/lib/stocks/sortie-stock.ts`) : écran et route disent la même unité.
 *
 * Module pur, importable par l'écran.
 */

import { uniteQuantiteRecolte, type UniteQuantite } from '@/lib/recolte/projection'

export function uniteSortieAffichee(
  stock: { unite?: UniteQuantite | null } | null | undefined,
  /** Espèce telle que `/api/especes` la sert : `uniteRendement` effectif. */
  espece: { uniteRendement?: string | null } | null | undefined,
): UniteQuantite {
  return stock?.unite ?? uniteQuantiteRecolte(espece?.uniteRendement)
}
