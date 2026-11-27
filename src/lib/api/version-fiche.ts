/**
 * Version de fiche : « la fiche que vous avez ouverte est-elle encore celle de
 * la base ? »
 *
 * Un formulaire de fiche renvoie tous ses champs. Resté ouvert dans un autre
 * onglet, sur un autre appareil ou chez un autre membre, il réécrivait avec
 * ses valeurs d'origine ce qui venait d'être changé ailleurs. Chaque fiche
 * porte un numéro `version` ; l'écran le mémorise au chargement et le renvoie
 * sous `versionLue` ; la route refuse en 409 s'il a changé, sinon écrit et
 * incrémente DANS LA MÊME ÉCRITURE (un `UPDATE` séparé relancerait les
 * déclencheurs de la table).
 *
 * Qui incrémente : toute écriture qui change un champ que le formulaire
 * renvoie (la route du formulaire, les gestes, l'assistant, les imports). Une
 * écriture dérivée (dernier arrosage, stock recalculé) n'incrémente pas :
 * c'est ce qui évite les faux refus du verrou par `updatedAt`
 * (`version-lue.ts`), qui bougeait à chaque écriture.
 *
 * La clé du corps est `versionLue`, jamais `version` : des écrans renvoient
 * l'objet entier reçu du serveur. Un appelant qui ne l'envoie pas (assistant,
 * script, onglet ouvert avant la mise en service) garde le comportement
 * d'avant.
 */
import { NextResponse } from 'next/server'
import { CODE_MODIFIE_AILLEURS } from './version-lue'

/** `'aucune'` : l'écran n'a vu aucune fiche (création attendue par un upsert). */
export type VersionLue = number | 'aucune' | undefined

export const INCREMENT_VERSION = { version: { increment: 1 } } as const

export type LectureVersion =
  | { ok: true; version: VersionLue; ancienneDate?: string }
  | { ok: false; erreur: string }

/**
 * Lit `versionLue` dans le corps brut. Une chaîne de date est l'ancien
 * protocole (verrou par `updatedAt`) d'un onglet ouvert avant la mise en
 * service : elle est rendue à part, pour être contrôlée comme avant.
 */
export function lireVersionLue(corps: unknown): LectureVersion {
  const brute = corps && typeof corps === 'object' ? (corps as Record<string, unknown>).versionLue : undefined
  if (brute === undefined || brute === null || brute === '') return { ok: true, version: undefined }
  if (brute === 'aucune') return { ok: true, version: 'aucune' }
  if (typeof brute === 'number' && Number.isInteger(brute) && brute >= 0) return { ok: true, version: brute }
  if (typeof brute === 'string' && !Number.isNaN(new Date(brute).getTime()) && /\d{4}-\d{2}-\d{2}T/.test(brute)) {
    return { ok: true, version: undefined, ancienneDate: brute }
  }
  return { ok: false, erreur: 'Version de fiche illisible.' }
}

/** Vrai si une version a été lue par l'écran et qu'elle n'est plus celle de la base. */
export function versionFichePerimee(lue: VersionLue, enBase: { version: number } | null | undefined): boolean {
  if (lue === undefined) return false
  if (lue === 'aucune') return enBase != null
  return enBase == null || enBase.version !== lue
}

const messageFicheModifiee = (quoi: string) =>
  `${quoi} : cette fiche a été modifiée depuis son ouverture (autre onglet, autre appareil ou autre membre). Rien n'a été enregistré.`

/** Refus 409 commun, avec la version actuelle pour que l'écran puisse recharger ou insister. */
export function reponseFicheModifiee(quoi: string, versionActuelle: number | null): NextResponse {
  return NextResponse.json(
    { error: messageFicheModifiee(quoi), code: CODE_MODIFIE_AILLEURS, versionActuelle },
    { status: 409 },
  )
}

/** Le même refus, à lever depuis une transaction ou du code de bibliothèque. */
export class FicheModifieeAilleurs extends Error {
  constructor(readonly quoi: string, readonly versionActuelle: number | null) {
    super(messageFicheModifiee(quoi))
  }
  reponse(): NextResponse {
    return reponseFicheModifiee(this.quoi, this.versionActuelle)
  }
}

/** Vrai si l'écriture change au moins un champ que le formulaire de la fiche renvoie. */
export function toucheChampsFiche(data: object, champs: readonly string[]): boolean {
  return champs.some((champ) => (data as Record<string, unknown>)[champ] !== undefined)
}
