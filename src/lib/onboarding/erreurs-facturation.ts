/**
 * Erreurs de l'étape « Identité de facturation » de l'accueil, par champ.
 *
 * FRONT-01 (recette du 2026-11-12) : un SIRET vide renvoyait un 400 dont le
 * détail (`details.fieldErrors.siret`) n'était jamais affiché. L'écran ne
 * montrait qu'un toast « Champs incorrects / Données invalides », sans dire
 * quel champ corriger. La règle serveur reste inchangée (SIRET exigé en
 * métropole et dans les DROM, art. 242 nonies A du CGI) ; ce module traduit
 * la réponse de PUT /api/exploitation (`parsed.error.flatten()`) pour l'écran.
 * Module pur.
 */

export type ErreursFacturation = Partial<Record<string, string>>

/** Libellés de l'écran, dans l'ordre d'affichage du formulaire. */
export const LIBELLES_CHAMPS_FACTURATION: ReadonlyArray<readonly [string, string]> = [
  ["raisonSociale", "Raison sociale"],
  ["siret", "SIRET"],
  ["identifiantLegal", "Identifiant légal"],
  ["emailContact", "Email contact"],
  ["adresseSiege", "Adresse"],
  ["codePostal", "Code postal"],
  ["ville", "Ville"],
  ["regimeTva", "Régime TVA"],
]

/** Premier message par champ, depuis `details.fieldErrors` d'une réponse 400. */
export function erreursDepuisReponse(corps: unknown): ErreursFacturation {
  const details = (corps as { details?: { fieldErrors?: Record<string, unknown> } } | null)?.details
  const champs = details?.fieldErrors
  if (!champs || typeof champs !== "object") return {}
  const erreurs: ErreursFacturation = {}
  for (const [champ, messages] of Object.entries(champs)) {
    const premier = Array.isArray(messages)
      ? messages.find((m): m is string => typeof m === "string" && m.trim() !== "")
      : undefined
    if (premier) erreurs[champ] = premier
  }
  return erreurs
}

/** Premier champ en erreur dans l'ordre de l'écran (pour y placer le focus). */
export function premierChampEnErreur(erreurs: ErreursFacturation): string | null {
  for (const [champ] of LIBELLES_CHAMPS_FACTURATION) if (erreurs[champ]) return champ
  const autres = Object.keys(erreurs).filter((c) => erreurs[c])
  return autres.length > 0 ? autres[0] : null
}

/** Résumé lisible pour la notification : « SIRET : SIRET invalide (…) ». */
export function resumeErreurs(erreurs: ErreursFacturation): string | null {
  const libelle = new Map(LIBELLES_CHAMPS_FACTURATION)
  const lignes = Object.entries(erreurs)
    .filter(([, message]) => message)
    .map(([champ, message]) => `${libelle.get(champ) ?? champ} : ${message}`)
  return lignes.length > 0 ? lignes.join(" · ") : null
}
