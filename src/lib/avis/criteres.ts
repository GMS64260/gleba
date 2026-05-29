/**
 * Configuration UI des avis par type d'objet (client-safe).
 * Définit les critères de notation et le libellé de la « reprise » propres à
 * chaque référentiel. C'est le seul endroit à toucher pour ajuster les critères.
 */

import type { AvisRefType } from './types'

export interface CritereDef {
  key: string
  label: string
}

export interface AvisConfig {
  /** Nom de l'objet (pour les libellés génériques). */
  labelObjet: string
  /** Question du « niveau 0 » (signal fort à 1 geste). */
  labelReprend: string
  /** Critères de notation (1-5), affichés dans l'ordre. */
  criteres: CritereDef[]
}

export const AVIS_CONFIG: Record<AvisRefType, AvisConfig> = {
  VARIETE: {
    labelObjet: 'variété',
    labelReprend: 'Vous la replantez l’an prochain ?',
    criteres: [
      { key: 'rendement', label: 'Rendement' },
      { key: 'resistance', label: 'Résistance' },
      { key: 'gout', label: 'Goût' },
      { key: 'facilite', label: 'Facilité' },
    ],
  },
  PORTE_GREFFE: {
    labelObjet: 'porte-greffe',
    labelReprend: 'Vous le recommandez ?',
    criteres: [
      { key: 'vigueur', label: 'Vigueur' },
      { key: 'productivite', label: 'Productivité' },
      { key: 'rusticite', label: 'Rusticité' },
      { key: 'ancrage', label: 'Ancrage / tenue' },
    ],
  },
  ESPECE: {
    labelObjet: 'espèce',
    labelReprend: 'Vous la recommandez ?',
    criteres: [
      { key: 'rendement', label: 'Rendement' },
      { key: 'resistance', label: 'Résistance' },
      { key: 'entretien', label: 'Entretien' },
      { key: 'facilite', label: 'Facilité' },
    ],
  },
  RACE: {
    labelObjet: 'race',
    labelReprend: 'Vous la recommandez ?',
    criteres: [
      { key: 'rusticite', label: 'Rusticité' },
      { key: 'productivite', label: 'Productivité' },
      { key: 'facilite', label: 'Facilité d’élevage' },
      { key: 'prolificite', label: 'Prolificité' },
    ],
  },
}

export function avisConfig(refType: AvisRefType): AvisConfig {
  return AVIS_CONFIG[refType]
}

export function criteresKeys(refType: AvisRefType): string[] {
  return AVIS_CONFIG[refType].criteres.map((c) => c.key)
}
