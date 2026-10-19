/**
 * Recherche du registre des interventions (`/interventions`).
 *
 * Ticket QA du 2026-10-19 : la recherche ne portait que sur le type, la
 * description, l'identifiant brut de la planche, l'intrant et les notes. La
 * colonne « Culture / Planche », celle que l'utilisateur lit, n'était jamais
 * interrogée : « Courge » ne retrouvait aucun des arrosages affichés
 * « Courge butternut - Courge butternut-Waltham », alors qu'un mot de la
 * description les retrouvait.
 *
 * Règle : on cherche dans ce que la ligne affiche, et le libellé affiché comme
 * le libellé cherché sortent de la même fonction (`libellesEmplacement`).
 * La comparaison ignore la casse, les accents et les tirets
 * (`normalizeReferentielKey`) ; chaque mot saisi doit apparaître dans la ligne,
 * dans n'importe quel champ et dans n'importe quel ordre.
 */

import { libelleCulture, type CulturePourLabel } from "@/lib/cultures/label"
import { normalizeReferentielKey } from "@/lib/normalize"
import { libelleTypeIntervention } from "./types"

/** Champs d'une ligne du registre, réelle ou dérivée (culture, arrosage noté…). */
export interface InterventionRecherchable {
  type: string | null
  description: string | null
  cultureNom: string | null
  plancheNom: string | null
  /** Identifiant de planche ou, pour d'anciennes saisies, son nom. */
  plancheId: string | null
  intrantNom: string | null
  produitPhyto: string | null
  notes: string | null
}

/**
 * Libellés de la colonne « Culture / Planche » : le nom résolu par l'API,
 * sinon celui de la culture chargée à côté ; la planche par son nom, sinon par
 * la référence stockée.
 */
export function libellesEmplacement(
  intervention: Pick<InterventionRecherchable, "cultureNom" | "plancheNom" | "plancheId">,
  culture?: CulturePourLabel | null,
): { culture: string | null; planche: string | null } {
  return {
    culture: intervention.cultureNom || (culture ? libelleCulture(culture) : null),
    planche: intervention.plancheNom || intervention.plancheId || null,
  }
}

/** Mots cherchés, repliés comme le texte des lignes. */
export function termesRecherche(saisie: string): string[] {
  return normalizeReferentielKey(saisie).split(" ").filter(Boolean)
}

/**
 * Texte cherchable d'une ligne, déjà replié. À calculer une fois par ligne
 * (l'écran le garde en mémoire tant que la liste ne change pas), pas à chaque
 * frappe.
 */
export function texteRechercheIntervention(
  intervention: InterventionRecherchable,
  culture?: CulturePourLabel | null,
): string {
  const emplacement = libellesEmplacement(intervention, culture)
  return normalizeReferentielKey(
    [
      libelleTypeIntervention(intervention.type),
      emplacement.culture,
      emplacement.planche,
      intervention.plancheId,
      intervention.description,
      intervention.intrantNom,
      intervention.produitPhyto,
      intervention.notes,
    ]
      .filter((v): v is string => Boolean(v))
      .join(" "),
  )
}

/** Vrai si le texte replié contient chacun des mots ; aucun mot ne filtre rien. */
export function texteContientTermes(texte: string, termes: readonly string[]): boolean {
  return termes.every((terme) => texte.includes(terme))
}

/**
 * Vrai si la ligne contient chacun des mots saisis. Une saisie vide ne filtre
 * rien.
 */
export function interventionCorrespond(
  intervention: InterventionRecherchable,
  saisie: string,
  culture?: CulturePourLabel | null,
): boolean {
  const termes = termesRecherche(saisie)
  if (termes.length === 0) return true
  return texteContientTermes(texteRechercheIntervention(intervention, culture), termes)
}
