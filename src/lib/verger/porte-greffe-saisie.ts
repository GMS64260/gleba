/**
 * Saisie du porte-greffe d'un arbre (`ChampPorteGreffe`, fiche et plan).
 *
 * Un arbre porte deux colonnes : `porteGreffeId` (référentiel, écrit par la
 * création depuis le catalogue) et `portGreffe` (texte libre historique). QA
 * cmvkp3kqc (2026-10-23) : l'inspecteur du plan effaçait l'id à la moindre
 * frappe et n'affichait que le texte, vide pour un arbre créé par le catalogue.
 */

import { normalizeReferentielKey } from "@/lib/normalize"

export interface ValeurPorteGreffe {
  porteGreffeId: string | null
  portGreffe: string | null
}

/**
 * Nouvelle valeur après une saisie libre : l'id du référentiel est gardé tant
 * que le texte désigne encore ce porte-greffe (casse, accents et tirets
 * ignorés) ; un autre texte devient une saisie libre sans id.
 */
export function valeurDepuisSaisieLibre(
  saisie: string,
  actuel: { porteGreffeId: string | null; libelle: string | null },
): ValeurPorteGreffe {
  const texte = saisie.trim()
  if (!texte) return { porteGreffeId: null, portGreffe: null }
  const garde =
    actuel.porteGreffeId != null &&
    actuel.libelle != null &&
    normalizeReferentielKey(actuel.libelle) === normalizeReferentielKey(texte)
  return { porteGreffeId: garde ? actuel.porteGreffeId : null, portGreffe: texte }
}
