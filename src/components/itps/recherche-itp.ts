/**
 * Recherche d'un ITP dans les calendriers (page Calendrier et tableau de bord).
 *
 * Une seule règle pour les deux vues, alignée sur la recherche serveur de la
 * liste (QA cmswxyuoi) : insensible aux accents, à la casse et à la
 * ponctuation, et portant aussi sur le NOM de l'espèce — l'identifiant d'une
 * espèce personnelle est un cuid que personne ne tape. La vue du tableau de
 * bord comparait en minuscules seulement, sans le nom d'espèce : « mache » n'y
 * trouvait pas « Mâche ».
 */

import { normalizeReferentielKey } from "@/lib/normalize"

interface ItpCherchable {
  id: string
  nom?: string | null
  especeId?: string | null
  espece?: { nom?: string | null } | null
}

/** Séparateur absent de toute clé normalisée : une saisie ne chevauche pas deux champs. */
const SEPARATEUR = " | "

/**
 * Texte normalisé dans lequel chercher. À calculer une fois par ITP (et non à
 * chaque frappe) : la normalisation de mille itinéraires à chaque caractère
 * saisi se sentait dans le champ de recherche.
 */
export function texteRechercheItp(itp: ItpCherchable): string {
  return [itp.id, itp.nom, itp.especeId, itp.espece?.nom]
    .filter((champ): champ is string => !!champ)
    .map((champ) => normalizeReferentielKey(champ))
    .join(SEPARATEUR)
}

/**
 * Vrai si la saisie correspond au texte de recherche d'un ITP. Une saisie sans
 * caractère signifiant (« - ») ne filtre rien.
 */
export function correspondRechercheItp(texte: string, saisie: string): boolean {
  const cle = normalizeReferentielKey(saisie)
  return !cle || texte.includes(cle)
}
