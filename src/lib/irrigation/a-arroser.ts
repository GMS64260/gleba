/**
 * « À arroser aujourd'hui » : seule source des lignes d'arrosage des tâches,
 * du calendrier potager, des notifications et de l'accueil.
 *
 * Refonte du 2026-10-10. L'ancien plan d'arrosage pré-générait un passage
 * tous les 2, 3 ou 5 jours de la plantation à la fin de récolte, sans saison
 * ni pluie : 17 comptes réels, 3 283 passages, 5 % notés faits, des arrosages
 * prévus tous les deux jours en janvier. Le besoin se calcule désormais chaque
 * jour depuis le bilan hydrique (`computeConseilIrrigation` : pluie passée et
 * prévue, ET0, sol, besoin de l'espèce, dernier arrosage noté). Noter un
 * arrosage remet le compteur à zéro ; rien n'est dû d'avance, donc rien n'est
 * « en retard » ni « périmé ».
 */

import { computeConseilIrrigation } from '@/lib/irrigation-conseil'

/** Urgences qui font une ligne « à arroser » ; « moyenne » et « faible » se surveillent. */
export const URGENCES_A_ARROSER = ['critique', 'haute'] as const
export type UrgenceAArroser = (typeof URGENCES_A_ARROSER)[number]

/** Sous-ensemble d'une culture du conseil, suffisant pour décider. */
export interface CultureConseil {
  id: number
  urgence: string
  raisonUrgence: string
  sousAbri: boolean
  espece: { nom: string | null } | null
  planche: { id: string; nom: string | null; ilot: string | null } | null
}

export interface ArrosageDuJour {
  /** Clé stable : `planche:<id>`, ou `culture:<id>` sans planche. */
  cle: string
  plancheRefId: string | null
  plancheNom: string | null
  ilot: string | null
  /** Cultures à noter ensemble (un passage arrose toute la planche). */
  cultureIds: number[]
  /** « Tomate + Basilic ». */
  especes: string
  /** La plus forte urgence de la planche. */
  urgence: UrgenceAArroser
  /** Raison de la culture la plus urgente (« Déficit de 18 mm, 4 j sans eau. »). */
  raison: string
  sousAbri: boolean
}

const RANG: Record<UrgenceAArroser, number> = { critique: 0, haute: 1 }

function estAArroser(urgence: string): urgence is UrgenceAArroser {
  return (URGENCES_A_ARROSER as readonly string[]).includes(urgence)
}

/** Regroupe par planche les cultures dont l'urgence impose un arrosage. Pur. */
export function arrosagesDuJour(cultures: CultureConseil[]): ArrosageDuJour[] {
  const groupes = new Map<string, CultureConseil[]>()
  for (const c of cultures) {
    if (!estAArroser(c.urgence)) continue
    const cle = c.planche ? `planche:${c.planche.id}` : `culture:${c.id}`
    const groupe = groupes.get(cle) ?? []
    groupe.push(c)
    groupes.set(cle, groupe)
  }

  const lignes = Array.from(groupes.entries()).map(([cle, groupe]) => {
    const tete = [...groupe].sort(
      (a, b) => RANG[a.urgence as UrgenceAArroser] - RANG[b.urgence as UrgenceAArroser],
    )[0]
    const especes = Array.from(
      new Set(groupe.map((c) => c.espece?.nom).filter((n): n is string => Boolean(n))),
    ).join(' + ')
    return {
      cle,
      plancheRefId: tete.planche?.id ?? null,
      plancheNom: tete.planche?.nom ?? null,
      ilot: tete.planche?.ilot ?? null,
      cultureIds: Array.from(new Set(groupe.map((c) => c.id))),
      especes,
      urgence: tete.urgence as UrgenceAArroser,
      raison: tete.raisonUrgence,
      sousAbri: groupe.some((c) => c.sousAbri),
    }
  })

  return lignes.sort(
    (a, b) =>
      RANG[a.urgence] - RANG[b.urgence] ||
      (a.ilot ?? '').localeCompare(b.ilot ?? '', 'fr') ||
      (a.plancheNom ?? '').localeCompare(b.plancheNom ?? '', 'fr', { numeric: true }),
  )
}

/**
 * Lignes « à arroser » du jour d'un compte, en lecture seule. Le conseil ne
 * vaut que pour la saison en cours : une autre année ne rend rien.
 */
export async function chargerArrosagesDuJour(userId: string, annee: number): Promise<ArrosageDuJour[]> {
  if (annee !== new Date().getFullYear()) return []
  const conseil = await computeConseilIrrigation(userId, annee)
  return arrosagesDuJour(conseil.data)
}
