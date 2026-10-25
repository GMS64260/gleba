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

/** Date saisie (objet ou chaîne) en ISO ; rien sinon. */
function versIso(d: unknown): string | null {
  if (!d) return null
  if (d instanceof Date) return d.toISOString()
  if (typeof d === 'string') return new Date(d).toISOString()
  return null
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
    dateSemis: versIso(culture.dateSemis),
    datePlantation: versIso(culture.datePlantation),
    dateRecolte: versIso(culture.dateRecolte),
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
