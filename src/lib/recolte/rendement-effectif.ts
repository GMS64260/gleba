/**
 * Rendement EFFECTIF d'une espèce chez un utilisateur : sa propre valeur si
 * elle existe, celle du catalogue sinon.
 *
 * Pourquoi cette couche. Le rendement du référentiel est un ordre de grandeur
 * partagé par tous les comptes, et une espèce du catalogue officiel n'est pas
 * modifiable par un membre (403, `api/especes/[id]`). Le 2026-08-20, un compte
 * de fleurs coupées a demandé à saisir ses rendements en tiges/m² : les unités
 * ont été ajoutées, mais le choix restait hors de portée de qui cultive du
 * catalogue — les 25 fleurs officielles restant déclarées en kg/m², avec des
 * valeurs qui ne veulent rien dire pour de la fleur coupée. Une surcharge par
 * ferme ferme cette impasse sans inventer de donnée de référentiel.
 *
 * Règle d'activation : la surcharge s'applique dès que l'un des deux champs est
 * renseigné. Déclarer l'unité sans la valeur est une information légitime — « mes
 * dahlias se comptent en tiges, je ne connais pas encore ma densité » — et vaut
 * mieux qu'une projection en kilos qu'on sait fausse. La projection rend alors 0
 * dans la bonne unité, et l'écran invite à renseigner la valeur.
 */

import prisma from '@/lib/prisma'

/** Ce que porte une source de rendement, catalogue ou ferme. */
export interface SourceRendement {
  rendement: number | null
  uniteRendement: string | null
}

export interface RendementEffectif {
  rendement: number | null
  /** Toujours renseignée : `kg_m2` est le défaut du schéma. */
  uniteRendement: string
  origine: 'ferme' | 'catalogue'
}

/** Une surcharge est-elle active ? (l'un des deux champs suffit) */
export function surchargeActive(surcharge: SourceRendement | null | undefined): boolean {
  return surcharge != null && (surcharge.rendement != null || surcharge.uniteRendement != null)
}

/**
 * Résout le rendement à utiliser. L'unité de la surcharge retombe sur celle du
 * catalogue quand elle n'est pas précisée : surcharger la seule VALEUR ne doit
 * pas changer ce que cette valeur mesure.
 */
export function rendementEffectif(
  catalogue: SourceRendement | null | undefined,
  surcharge?: SourceRendement | null,
): RendementEffectif {
  const uniteCatalogue = catalogue?.uniteRendement ?? 'kg_m2'
  if (!surchargeActive(surcharge)) {
    return {
      rendement: catalogue?.rendement ?? null,
      uniteRendement: uniteCatalogue,
      origine: 'catalogue',
    }
  }
  return {
    rendement: surcharge!.rendement ?? null,
    uniteRendement: surcharge!.uniteRendement ?? uniteCatalogue,
    origine: 'ferme',
  }
}

/**
 * Surcharges d'un utilisateur, indexées par espèce.
 *
 * Une seule requête, à charger une fois par calcul plutôt qu'espèce par espèce :
 * les agrégats de récolte tournent déjà sur plusieurs centaines de cultures.
 */
export async function chargerSurchargesRendement(
  userId: string,
  especeIds?: string[],
): Promise<Map<string, SourceRendement>> {
  if (especeIds && especeIds.length === 0) return new Map()
  const lignes = await prisma.userStockEspece.findMany({
    where: {
      userId,
      ...(especeIds ? { especeId: { in: especeIds } } : {}),
      OR: [{ rendement: { not: null } }, { uniteRendement: { not: null } }],
    },
    select: { especeId: true, rendement: true, uniteRendement: true },
  })
  return new Map(
    lignes.map((ligne) => [
      ligne.especeId,
      { rendement: ligne.rendement, uniteRendement: ligne.uniteRendement },
    ]),
  )
}

/**
 * Applique les surcharges à une liste d'espèces du catalogue.
 *
 * Rend les champs `rendement`/`uniteRendement` REMPLACÉS par l'effectif, et
 * conserve les valeurs du catalogue sous `rendementCatalogue` /
 * `uniteRendementCatalogue`. C'est ce que les API renvoient : tout écran qui lit
 * `espece.rendement` obtient dès lors la vérité de la ferme, sans avoir à
 * connaître l'existence de la surcharge, et l'écran de fiche garde de quoi
 * afficher la référence à côté.
 */
export function appliquerSurcharges<T extends { id: string } & SourceRendement>(
  especes: T[],
  surcharges: Map<string, SourceRendement>,
): Array<
  T & {
    rendementCatalogue: number | null
    uniteRendementCatalogue: string | null
    origineRendement: 'ferme' | 'catalogue'
  }
> {
  return especes.map((espece) => {
    const effectif = rendementEffectif(espece, surcharges.get(espece.id))
    return {
      ...espece,
      rendement: effectif.rendement,
      uniteRendement: effectif.uniteRendement,
      rendementCatalogue: espece.rendement,
      uniteRendementCatalogue: espece.uniteRendement,
      origineRendement: effectif.origine,
    }
  })
}
