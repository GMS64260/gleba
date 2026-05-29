/**
 * Référentiel communautaire — calculs d'agrégation des avis (purs, client-safe).
 * Mêmes formules que le V1 variété, mais génériques : la note globale d'un avis
 * est la moyenne des valeurs de son objet `notes` ({ critereKey: 1-5 }).
 */

import { z } from 'zod'
import {
  type AvisNotable,
  type StatsAvis,
  type GroupeTerroir,
  POIDS_BAYESIEN,
  NOTE_DEFAUT,
  SEUIL_TERROIR,
} from './types'

function moyenne(valeurs: number[]): number | null {
  if (valeurs.length === 0) return null
  return valeurs.reduce((s, v) => s + v, 0) / valeurs.length
}

/** Valeurs numériques renseignées d'un avis (notes 1-5). */
function valeursNotes(a: AvisNotable): number[] {
  return Object.values(a.notes ?? {}).filter((n): n is number => typeof n === 'number')
}

/** Note globale d'un avis = moyenne de ses critères renseignés (null si aucun). */
export function noteGlobaleAvis(a: AvisNotable): number | null {
  return moyenne(valeursNotes(a))
}

/** Moyenne générale des notes globales sur un ensemble d'avis (pour le lissage bayésien). */
export function moyenneGlobaleNotes(avis: AvisNotable[]): number {
  const notes = avis.map(noteGlobaleAvis).filter((n): n is number => n != null)
  return moyenne(notes) ?? NOTE_DEFAUT
}

/**
 * Moyenne bayésienne : lisse vers la moyenne générale tant que le nombre d'avis
 * est faible. Empêche qu'un objet 5★/1 avis dépasse un 4,3★/200 avis.
 */
export function moyenneBayesienne(
  somme: number,
  n: number,
  moyenneGenerale: number,
  m: number = POIDS_BAYESIEN
): number {
  if (n + m === 0) return moyenneGenerale
  return (m * moyenneGenerale + somme) / (m + n)
}

/** Statistiques agrégées d'un objet. `criteres` = clés de critères du type. */
export function calculerStats(
  avis: AvisNotable[],
  moyenneGenerale: number,
  criteres: string[]
): StatsAvis {
  const nbAvis = avis.length

  const reprendRenseigne = avis.filter((a) => a.reprend != null)
  const tauxReprise =
    reprendRenseigne.length > 0
      ? reprendRenseigne.filter((a) => a.reprend === true).length / reprendRenseigne.length
      : null

  const notesGlobales = avis.map(noteGlobaleAvis).filter((n): n is number => n != null)
  const noteMoyenne = moyenne(notesGlobales)
  const scoreCommunautaire = moyenneBayesienne(
    notesGlobales.reduce((s, v) => s + v, 0),
    notesGlobales.length,
    moyenneGenerale
  )

  const moyennesParCritere = Object.fromEntries(
    criteres.map((k) => [
      k,
      moyenne(
        avis
          .map((a) => a.notes?.[k])
          .filter((n): n is number => typeof n === 'number')
      ),
    ])
  ) as Record<string, number | null>

  return { nbAvis, tauxReprise, noteMoyenne, scoreCommunautaire, moyennesParCritere }
}

/**
 * Ventile les avis par terroir (sol × zone climatique) — bloc « Selon le terroir ».
 * Tous les groupes sont retournés (triés par volume) ; `fiable` signale le faible
 * volume sans masquer l'info (honnêteté sur le démarrage à froid).
 */
export function dispersionParTerroir(avis: AvisNotable[]): GroupeTerroir[] {
  const groupes = new Map<string, AvisNotable[]>()
  for (const a of avis) {
    const cle = `${a.contexteTypeSol ?? ''}|${a.contexteZoneClimat ?? ''}`
    const liste = groupes.get(cle)
    if (liste) liste.push(a)
    else groupes.set(cle, [a])
  }

  return [...groupes.values()]
    .map((liste): GroupeTerroir => {
      const notes = liste.map(noteGlobaleAvis).filter((n): n is number => n != null)
      return {
        typeSol: liste[0].contexteTypeSol ?? null,
        zoneClimat: liste[0].contexteZoneClimat ?? null,
        nbAvis: liste.length,
        noteMoyenne: moyenne(notes),
        fiable: liste.length >= SEUIL_TERROIR,
      }
    })
    .sort((a, b) => b.nbAvis - a.nbAvis)
}

/** Schéma de validation d'un avis posté, restreint aux critères du type. */
export function avisSchema(criteres: string[]) {
  const noteSchema = z.number().int().min(1).max(5).nullable().optional()
  const notesShape = Object.fromEntries(criteres.map((k) => [k, noteSchema]))
  return z
    .object({
      reprend: z.boolean().nullable().optional(),
      notes: z.object(notesShape).optional(), // les clés hors-critères sont ignorées
      commentaire: z.string().max(2000).nullable().optional(),
    })
    .refine(
      (d) =>
        d.reprend != null ||
        (d.notes != null && Object.values(d.notes).some((v) => v != null)) ||
        (d.commentaire != null && d.commentaire.trim().length > 0),
      { message: 'Renseignez au moins un élément : la reprise, une note ou un commentaire.' }
    )
}
