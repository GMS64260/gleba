/**
 * Sortie de stock d'une récolte (vente, don, autoconsommation, perte) :
 * l'unité est celle du STOCK de l'espèce, jamais un kilo supposé.
 *
 * QA cmvgef6ou (2026-10-20) : un stock de 19 tiges de dahlia (Stocks >
 * Récoltes) était proposé « Dahlia (stock: 19.0 kg) » dans Consommations >
 * Nouvelle sortie, avec un champ « Quantité (kg) ». L'unité de comptage
 * (kg, tige, pièce, botte) se décide par espèce pour la ferme (surcharge
 * `UserStockEspece`, sinon catalogue) et fige celle des récoltes ; le stock net
 * (`calculerStocksNet`) la portait déjà, l'écran et la route l'ignoraient.
 *
 * Une `Consommation` n'a pas de colonne d'unité : elle se compte dans l'unité
 * du stock de son espèce, celle que `calculerStocksNet` lui retranche. C'est
 * la même convention que `UserStockEspece.inventaire` (« dans l'unité de
 * l'espèce »). Ce module est la seule source de cette unité pour le stock net,
 * la route `/api/consommations` et l'assistant (`create_consommation`).
 */

import prisma from '@/lib/prisma'
import { visibiliteReferentiel } from '@/lib/referentiel-communaute'
import {
  libelleUniteQuantite,
  uniteQuantiteRecolte,
  UNITES_QUANTITE,
  type UniteQuantite,
} from '@/lib/recolte/projection'
import { chargerSurchargesRendement, rendementEffectif } from '@/lib/recolte/rendement-effectif'

/**
 * Unité du stock de récolte de chaque espèce chez ce compte : celle que la
 * ferme a déclarée, sinon celle du catalogue (kg par défaut).
 */
export async function chargerUnitesStock(
  userId: string,
  especeIds: string[],
): Promise<Map<string, UniteQuantite>> {
  if (especeIds.length === 0) return new Map()
  const [especes, surcharges] = await Promise.all([
    prisma.espece.findMany({
      where: { id: { in: especeIds } },
      select: { id: true, rendement: true, uniteRendement: true },
    }),
    chargerSurchargesRendement(userId, especeIds),
  ])
  return new Map(
    especes.map((e) => [
      e.id,
      uniteQuantiteRecolte(rendementEffectif(e, surcharges.get(e.id)).uniteRendement),
    ]),
  )
}

/**
 * Une sortie retire du stock : quantité finie et strictement positive (une
 * sortie négative AUGMENTAIT le stock net par l'assistant, revue du
 * 2026-10-20). Une tige, une pièce ou une botte se compte : « 2,5 tiges » est
 * refusé, comme à la vente depuis Récoltes > Stock (QA cmv2r1oao). Le refus
 * nomme son champ.
 */
export function refusQuantiteSortie(quantite: number, unite: UniteQuantite): string | null {
  if (typeof quantite !== 'number' || !Number.isFinite(quantite) || quantite <= 0) {
    return 'Données invalides — quantite : une quantité strictement positive est attendue.'
  }
  if (unite !== 'kg' && !Number.isInteger(quantite)) {
    return `Données invalides — quantite : un nombre entier de ${libelleUniteQuantite(unite, 2)} est attendu.`
  }
  return null
}

/** L'unité annoncée est-elle une unité de quantité connue ? */
export function estUniteQuantite(valeur: unknown): valeur is UniteQuantite {
  return typeof valeur === 'string' && (UNITES_QUANTITE as readonly string[]).includes(valeur)
}

export type PreparationSortie =
  | { ok: true; especeId: string; nom: string; unite: UniteQuantite }
  | { ok: false; status: 400 | 404; error: string }

/**
 * Règle d'une sortie de stock, pour la route et l'assistant : espèce visible
 * du compte, unité du stock, quantité entière pour une unité dénombrée.
 *
 * `unite`, si l'appelant la donne, est celle qu'il a AFFICHÉE : elle doit être
 * celle du stock, sinon l'écran montrait des kilos pour des tiges (ou l'unité
 * de l'espèce a changé depuis l'ouverture du formulaire) et l'on refuse plutôt
 * que d'enregistrer 1 tige pour 1 kg en silence.
 */
export async function preparerSortieStock(
  userId: string,
  saisie: { especeId: string; quantite: number; unite?: UniteQuantite | null },
): Promise<PreparationSortie> {
  // Une espèce privée d'un autre compte n'est pas rattachable (même garde que
  // create_culture, 2026-10-19). `nom` : libellé d'une espèce perso (son id
  // est un cuid).
  const espece = await prisma.espece.findFirst({
    where: { AND: [{ id: saisie.especeId }, visibiliteReferentiel(userId)] },
    select: { id: true, nom: true },
  })
  if (!espece) {
    return { ok: false, status: 404, error: `Espèce "${saisie.especeId}" introuvable` }
  }

  const unite = (await chargerUnitesStock(userId, [espece.id])).get(espece.id) ?? 'kg'
  if (saisie.unite && saisie.unite !== unite) {
    return {
      ok: false,
      status: 400,
      error: `Données invalides — unite : le stock de ${espece.nom ?? espece.id} se compte en ${libelleUniteQuantite(unite, 2)}, pas en ${libelleUniteQuantite(saisie.unite, 2)}. Saisissez la sortie en ${libelleUniteQuantite(unite, 2)}.`,
    }
  }

  const refus = refusQuantiteSortie(saisie.quantite, unite)
  if (refus) return { ok: false, status: 400, error: refus }

  return { ok: true, especeId: espece.id, nom: espece.nom ?? espece.id, unite }
}
