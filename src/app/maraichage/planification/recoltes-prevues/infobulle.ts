import { UNITES_QUANTITE, type UniteQuantite } from "@/lib/recolte/projection"
import { formatQuantite } from "@/lib/recolte/quantites"

/**
 * Texte de l'infobulle du graphique « Récoltes mensuelles prévues ».
 *
 * L'unité est la CLÉ de la série (`dataKey` : kg, tige, piece, botte), pas son
 * nom de légende. Le graphique passait le libellé (« tiges »), inconnu des
 * unités, et le repli sur les kilos affichait « 360 kg » pour 360 tiges.
 */
export function quantiteInfobulle(valeur: unknown, cleSerie: unknown): string {
  const unite = UNITES_QUANTITE.find((u) => u === cleSerie) ?? ("kg" satisfies UniteQuantite)
  return formatQuantite(Number(valeur) || 0, unite)
}
