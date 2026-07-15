/**
 * Adéquation d'une espèce à la zone climatique de l'utilisateur (référentiel
 * géographique). Sert au badge « adaptée / peu adaptée à votre zone » du
 * catalogue et à l'avertissement de plantation (fruitier à besoin de froid en
 * climat tropical).
 *
 * Deux signaux, du plus explicite au plus déductif :
 *   1. `zonesAdaptees` : liste blanche de zones (CSV de valeurs ZONES_CLIMAT).
 *      Renseignée → verdict direct (dans la liste = adaptée, sinon peu adaptée).
 *   2. `besoinFroid` : besoin de froid hivernal (aucun|faible|modere|eleve).
 *      À défaut de liste blanche, un besoin de froid marqué (modéré/élevé)
 *      disqualifie l'espèce en zone tropicale de plaine (pas de vernalisation).
 *
 * Sans aucun signal, l'espèce est NEUTRE (statut « inconnue » = pas de badge) :
 * c'est le comportement historique de tout le catalogue métropolitain.
 */

import type { ZoneClimat } from './terroir'
import { zoneHorsReferenceMetropole } from './calendrier-climat'

export type AdequationZone = 'adaptee' | 'peu_adaptee' | 'inconnue'

export interface AdequationResultat {
  statut: AdequationZone
  /** Explication courte (peu_adaptee) — null sinon. */
  raison: string | null
}

/** Besoins de froid considérés incompatibles avec une zone tropicale de plaine. */
const BESOIN_FROID_MARQUE = new Set(['modere', 'eleve'])

/** Parse le CSV `zonesAdaptees` en un ensemble de zones (tolérant aux espaces). */
export function parseZonesAdaptees(csv: string | null | undefined): Set<string> {
  if (!csv) return new Set()
  return new Set(
    csv
      .split(',')
      .map((z) => z.trim())
      .filter(Boolean)
  )
}

export function adequationEspece(opts: {
  zonesAdaptees?: string | null
  besoinFroid?: string | null
  userZone: ZoneClimat | null | undefined
}): AdequationResultat {
  const { zonesAdaptees, besoinFroid, userZone } = opts

  // Sans zone utilisateur connue, aucune adéquation à calculer.
  if (!userZone) return { statut: 'inconnue', raison: null }

  // 1. Liste blanche explicite.
  const zones = parseZonesAdaptees(zonesAdaptees)
  if (zones.size > 0) {
    if (zones.has(userZone)) return { statut: 'adaptee', raison: null }
    return {
      statut: 'peu_adaptee',
      raison: "conçue pour d'autres zones climatiques",
    }
  }

  // 2. Déduction par le besoin de froid : un fruitier à froid marqué ne
  //    fructifie pas en zone tropicale de plaine (dormance non levée).
  if (besoinFroid && BESOIN_FROID_MARQUE.has(besoinFroid) && zoneHorsReferenceMetropole(userZone)) {
    return {
      statut: 'peu_adaptee',
      raison: 'a besoin de froid hivernal, absent en climat tropical de plaine',
    }
  }

  // Aucun signal → neutre.
  return { statut: 'inconnue', raison: null }
}

/** Libellé/couleur du badge d'adéquation (null = pas de badge). */
export function badgeAdequation(
  statut: AdequationZone
): { label: string; cls: string } | null {
  if (statut === 'adaptee') return { label: 'Adaptée à votre zone', cls: 'bg-emerald-100 text-emerald-700' }
  if (statut === 'peu_adaptee') return { label: 'Peu adaptée ici', cls: 'bg-amber-100 text-amber-700' }
  return null
}
