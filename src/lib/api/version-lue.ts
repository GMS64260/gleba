/**
 * Verrou optimiste des fiches : « la version que vous avez ouverte est-elle
 * encore celle de la base ? »
 *
 * Un formulaire de fiche renvoie tous ses champs, pas seulement ceux touchés.
 * Ouvert dans deux onglets (ou par deux membres), le second enregistrement
 * réécrivait donc avec ses valeurs d'origine ce que le premier venait de
 * changer, et les deux répondaient 200 (équipe debug, D74 : une note effacée).
 *
 * L'écran mémorise le `updatedAt` reçu au chargement et le renvoie sous
 * `versionLue`. La route, qui a relu la fiche sous son verrou, refuse en 409
 * si elle a changé entre-temps. Le champ est facultatif : un appelant qui ne
 * l'envoie pas (assistant, script, ancien onglet) garde le comportement
 * d'avant.
 */
import { NextResponse } from 'next/server'

export const CODE_MODIFIE_AILLEURS = 'MODIFIE_AILLEURS'

/** Vrai si une version a été envoyée et qu'elle n'est plus celle de la base. */
export function versionPerimee(versionLue: unknown, updatedAt: Date | null | undefined): boolean {
  if (versionLue === undefined || versionLue === null || versionLue === '') return false
  if (!updatedAt) return false
  const lue = versionLue instanceof Date ? versionLue : new Date(String(versionLue))
  // Version illisible : on ne peut pas affirmer que la fiche est à jour.
  if (Number.isNaN(lue.getTime())) return true
  return lue.getTime() !== updatedAt.getTime()
}

/** Refus 409 commun, avec la version actuelle pour que l'écran puisse se recharger. */
export function reponseModifieAilleurs(quoi: string, updatedAt: Date): NextResponse {
  return NextResponse.json(
    {
      error: `${quoi} a été modifiée depuis son ouverture (autre onglet, autre appareil ou autre membre). Rechargez-la avant d'enregistrer : vos changements ne sont pas enregistrés.`,
      code: CODE_MODIFIE_AILLEURS,
      versionActuelle: updatedAt.toISOString(),
    },
    { status: 409 },
  )
}
