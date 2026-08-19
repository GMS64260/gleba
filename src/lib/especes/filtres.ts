/**
 * Filtres serveur du catalogue Espèces : zone climatique et avis communautaires.
 *
 * Ces deux filtres doivent s'appliquer AVANT la pagination, sinon une page ne
 * contient qu'un sous-ensemble arbitraire des espèces retenues.
 */

import type { Prisma } from '@prisma/client'

import type { AvisStatsListe } from '@/lib/avis/types'
import { zoneHorsReferenceMetropole } from '@/lib/calendrier-climat'
import type { ZoneClimat } from '@/lib/terroir'

/** Besoins de froid incompatibles avec une zone tropicale de plaine. */
const BESOIN_FROID_MARQUE = ['modere', 'eleve']

/**
 * Condition Prisma « cultivable dans cette zone », miroir exact de
 * `adequationEspece` : on retient tout ce qui n'est PAS « peu adaptée ».
 *
 * Le catalogue métropolitain laisse `zonesAdaptees` vide (neutre partout) :
 * filtrer sur la seule liste blanche ne remonterait que les 40 espèces
 * tropicales. On exclut donc les espèces explicitement prévues pour d'autres
 * zones, plus celles dont le besoin de froid ne peut être satisfait sous les
 * tropiques.
 */
export function whereZoneCultivable(zone: ZoneClimat): Prisma.EspeceWhereInput {
  // `zonesAdaptees` est un CSV : on teste l'appartenance exacte du jeton pour
  // ne pas confondre « oceanique » et « oceanique_altere ».
  const zoneListee: Prisma.EspeceWhereInput = {
    OR: [
      { zonesAdaptees: zone },
      { zonesAdaptees: { startsWith: `${zone},` } },
      { zonesAdaptees: { endsWith: `,${zone}` } },
      { zonesAdaptees: { contains: `,${zone},` } },
    ],
  }

  const sansListe: Prisma.EspeceWhereInput = {
    OR: [{ zonesAdaptees: null }, { zonesAdaptees: '' }],
  }

  if (!zoneHorsReferenceMetropole(zone)) {
    return { OR: [zoneListee, sansListe] }
  }

  // Sous les tropiques, une espèce sans liste blanche reste candidate seulement
  // si elle n'exige pas de froid hivernal.
  return {
    OR: [
      zoneListee,
      {
        AND: [
          sansListe,
          { OR: [{ besoinFroid: null }, { besoinFroid: { notIn: BESOIN_FROID_MARQUE } }] },
        ],
      },
    ],
  }
}

export const AVIS_FILTRES = ['avec', 'note3', 'note4', 'recommandees'] as const
export type AvisFiltre = (typeof AVIS_FILTRES)[number]

export const AVIS_FILTRE_LABELS: Record<AvisFiltre, string> = {
  avec: 'Avec avis',
  note3: 'Note ≥ 3',
  note4: 'Note ≥ 4',
  recommandees: 'Recommandées',
}

export function isAvisFiltre(valeur: unknown): valeur is AvisFiltre {
  return typeof valeur === 'string' && (AVIS_FILTRES as readonly string[]).includes(valeur)
}

/** Seuil de taux de reprise (« je la replante ») pour « Recommandées ». */
export const SEUIL_RECOMMANDEE = 0.7

/** Vrai si les stats d'avis d'une espèce satisfont le filtre demandé. */
export function retenuParAvis(stats: AvisStatsListe | undefined, filtre: AvisFiltre): boolean {
  if (!stats || stats.nbAvis === 0) return false
  switch (filtre) {
    case 'avec':
      return true
    case 'note3':
      return stats.noteMoyenne != null && stats.noteMoyenne >= 3
    case 'note4':
      return stats.noteMoyenne != null && stats.noteMoyenne >= 4
    case 'recommandees':
      return stats.tauxReprise != null && stats.tauxReprise >= SEUIL_RECOMMANDEE
  }
}
