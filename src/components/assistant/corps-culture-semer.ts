/**
 * Corps envoyé à `POST /api/cultures` par l'assistant « Semer », et nombre de
 * plants qu'il affiche : une seule fonction pure pour les deux, testée.
 *
 * Ticket QA cmvnpkkhp (2026-10-25) — le récapitulatif affichait « ~159
 * plants » calculés sur des valeurs qu'il n'envoyait pas toutes (longueur de
 * la planche, 1 rang et 30 cm supposés), et n'envoyait pas la quantité : la
 * culture naissait sans plants. Le calcul porte désormais sur les valeurs
 * envoyées, par la règle de la route (`nbPlantsCulture`).
 */
import { nbPlantsCulture } from '@/lib/cultures/quantite-plants'
import { jourCivilStocke } from '@/lib/jour-civil'
import type { AssistantState } from './AssistantDialog'

export type DonneePlants = 'longueur' | 'rangs' | 'espacement'

export interface PlantsSemer {
  /** Longueur de la culture, sinon celle de la planche (comme « Nouvelle culture »). */
  longueur: number | null
  nbRangs: number | null
  espacement: number | null
  /** Plants envoyés et affichés ; null quand une donnée manque. */
  quantite: number | null
  manquants: DonneePlants[]
}

export function plantsSemer(state: Pick<AssistantState, 'culture' | 'planche'>): PlantsSemer {
  const longueur = state.culture.longueur || state.planche.longueur || null
  const nbRangs = state.culture.nbRangs || null
  const espacement = state.culture.espacement || null
  const manquants: DonneePlants[] = []
  if (!longueur) manquants.push('longueur')
  if (!nbRangs) manquants.push('rangs')
  if (!espacement) manquants.push('espacement')
  const n = nbPlantsCulture(longueur, nbRangs, espacement)
  return { longueur, nbRangs, espacement, quantite: n != null && n > 0 ? n : null, manquants }
}

/** « longueur », « rangs et espacement », « longueur, rangs et espacement ». */
export function libelleDonneesManquantes(manquants: DonneePlants[]): string {
  if (manquants.length <= 1) return manquants.join('')
  return `${manquants.slice(0, -1).join(', ')} et ${manquants[manquants.length - 1]}`
}

/**
 * Date de l'assistant envoyée au serveur : son JOUR « AAAA-MM-JJ », comme le
 * formulaire « Nouvelle culture ». Rien si absente ou illisible.
 *
 * Ticket QA cmvnulry1 (2026-10-25) : l'envoi passait par `toISOString()`. Les
 * dates de l'assistant sont des minuits LOCAUX (calculées depuis l'ITP par
 * `semaineVersDate`, ou saisies) : le 12 avril à Paris partait
 * « 2027-04-11T22:00:00.000Z », stocké la veille au soir et lu au 11 par le
 * Registre de culture. Le jour local d'un minuit local est le jour voulu dans
 * tout fuseau (`jourCivilStocke`). Sert aussi à la vérification d'occupation
 * de l'étape Dates, pour que le verdict porte sur les jours enregistrés.
 */
export function jourEnvoye(d: unknown): string | null {
  return d instanceof Date || typeof d === 'string' ? jourCivilStocke(d) : null
}

export function corpsCultureSemer(
  state: Pick<AssistantState, 'culture' | 'planche' | 'espece' | 'variete' | 'itp'>,
  options: { plancheId: string | null; aIrriguer: boolean },
) {
  const { culture, espece, variete, itp } = state
  const plants = plantsSemer(state)
  return {
    especeId: espece?.id || culture.especeId,
    varieteId: variete?.id || culture.varieteId || null,
    itpId: itp?.id || culture.itpId || null,
    plancheId: options.plancheId || null,
    annee: culture.annee,
    dateSemis: jourEnvoye(culture.dateSemis),
    datePlantation: jourEnvoye(culture.datePlantation),
    dateRecolte: jourEnvoye(culture.dateRecolte),
    nbRangs: plants.nbRangs,
    longueur: plants.longueur,
    espacement: plants.espacement,
    quantite: plants.quantite,
    aIrriguer: options.aIrriguer,
    semisFait: false,
    plantationFaite: false,
    recolteFaite: false,
  }
}
