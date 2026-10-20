/**
 * Projection au registre phytosanitaire des colonnes réellement écrites par
 * chaque formulaire de traitement.
 *
 * QA cmvgeltj1 (2026-10-20) : un traitement saisi depuis Verger > Santé &
 * Phyto > Registre phyto (table `observations_sante`) ressortait au registre
 * général (Traçabilité) avec Surface « Manquant », ZNT « - », Météo « - » et
 * l'exploitation pour applicateur, alors que la ligne portait 0,01 ha, une ZNT
 * de 20 m respectée, 15 °C / vent 5 / hygrométrie 70 / sans pluie et
 * l'opérateur saisi. Le registre général forçait ces colonnes à null pour les
 * observations et ne lisait la météo que dans le texte libre déprécié
 * `interventions.conditions_meteo`. Les trois sources (interventions,
 * observations santé, opérations d'arbre) passent désormais par ces helpers.
 *
 * Module pur (aucun accès base).
 */

import { formatNombre } from '@/lib/format-utils'

// ---------------------------------------------------------------------------
// Opérateur saisi en texte libre
// ---------------------------------------------------------------------------

/**
 * Les formulaires du verger saisissent l'opérateur en texte libre, alors que
 * `operateur_id` est une clé étrangère vers un compte : le nom est conservé
 * dans les notes sous ce préfixe (« Opérateur : Hélène »), seul emplacement
 * sans migration. Contrat entre l'écriture (POST /api/arbres/observations,
 * Verger > Opérations) et la lecture (registre général, export).
 */
export const PREFIXE_OPERATEUR = 'Opérateur : '

/**
 * Revue du 2026-10-20 : le nom s'arrête à la fin de la ligne et au séparateur
 * « — » de Verger > Opérations. Avec `\s*`, une ligne « Opérateur : » laissée
 * vide prenait la ligne suivante des notes pour applicateur, et « Opérateur :
 * X — Opérateur : Y » rendait « X — Opérateur : Y ».
 */
const MOTIF_OPERATEUR = /(?:^|\s)Opérateur[ \t]*:[ \t]*([^\n—]*)/g

/** Nom d'opérateur conservé dans les notes (le dernier mentionné), ou null. */
export function operateurDansNotes(notes: string | null | undefined): string | null {
  if (!notes) return null
  let nom: string | null = null
  for (const trouve of notes.matchAll(MOTIF_OPERATEUR)) {
    const valeur = trouve[1].trim()
    if (valeur) nom = valeur
  }
  return nom
}

/**
 * Notes à enregistrer : celles saisies, suivies de la ligne « Opérateur : … »
 * quand un nom est fourni et que les notes ne le portent pas déjà (un ancien
 * écran composait lui-même cette ligne).
 */
export function notesAvecOperateur(
  notes: string | null | undefined,
  operateurNom: string | null | undefined,
): string | null {
  const texte = notes?.trim() || ''
  const nom = operateurNom?.replace(/\s+/g, ' ').trim() || ''
  if (!nom || operateurDansNotes(texte) === nom) return texte || null
  return [texte, `${PREFIXE_OPERATEUR}${nom}`].filter(Boolean).join('\n')
}

interface Personne {
  name: string | null
  email: string | null
}

/**
 * Applicateur d'un traitement : l'opérateur désigné (compte, à défaut nom
 * saisi dans les notes), sinon le titulaire du compte. Même règle pour l'écran
 * Traçabilité, son export et l'assistant.
 */
export function applicateurPhyto(source: {
  operateur?: Personne | null
  notes?: string | null
  user: Personne
}): string {
  return (
    source.operateur?.name ||
    source.operateur?.email ||
    operateurDansNotes(source.notes) ||
    source.user.name ||
    source.user.email ||
    ''
  )
}

/** Opérateur désigné (compte ou nom saisi), sans repli sur le titulaire du compte. */
export function operateurPhyto(source: { operateur?: Personne | null; notes?: string | null }): string | null {
  return source.operateur?.name || source.operateur?.email || operateurDansNotes(source.notes) || null
}

// ---------------------------------------------------------------------------
// Surface
// ---------------------------------------------------------------------------

/**
 * Surface traitée en m², unité du registre et de son total. Le formulaire
 * Interventions saisit des m² (`surface_traitee`), le formulaire du verger des
 * hectares (`surface_traitee_ha`) : 0,01 ha = 100 m².
 */
export function surfaceRegistreM2(source: {
  surfaceTraitee?: number | null
  surfaceTraiteeHa?: number | null
}): number | null {
  if (source.surfaceTraitee != null && source.surfaceTraitee > 0) return source.surfaceTraitee
  if (source.surfaceTraiteeHa != null && source.surfaceTraiteeHa > 0) {
    return Math.round(source.surfaceTraiteeHa * 10_000 * 100) / 100
  }
  return null
}

// ---------------------------------------------------------------------------
// Météo
// ---------------------------------------------------------------------------

/**
 * Conditions météo lisibles : « 15 °C · vent 5 km/h · hygrométrie 70 % ·
 * sans pluie ±24 h ». Le texte libre historique (`conditions_meteo`, déprécié)
 * prime quand il existe ; sinon les relevés structurés du formulaire.
 */
export function libelleMeteoPhyto(source: {
  conditionsMeteo?: string | null
  temperatureC?: number | null
  ventKmh?: number | null
  hygrometriePct?: number | null
  pluie24h?: boolean | null
  pluie24hMm?: number | null
}): string | null {
  const libre = source.conditionsMeteo?.trim()
  if (libre) return libre
  const parties: string[] = []
  if (source.temperatureC != null) parties.push(`${formatNombre(source.temperatureC, 1)} °C`)
  if (source.ventKmh != null) parties.push(`vent ${formatNombre(source.ventKmh, 1)} km/h`)
  if (source.hygrometriePct != null) parties.push(`hygrométrie ${formatNombre(source.hygrometriePct)} %`)
  if (source.pluie24h === false) parties.push('sans pluie ±24 h')
  else if (source.pluie24h === true) {
    parties.push(
      source.pluie24hMm != null ? `pluie ±24 h (${formatNombre(source.pluie24hMm, 1)} mm)` : 'pluie ±24 h',
    )
  }
  return parties.length ? parties.join(' · ') : null
}
