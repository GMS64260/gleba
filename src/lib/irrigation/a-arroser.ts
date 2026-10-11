/**
 * « À arroser aujourd'hui » : seule source des lignes d'arrosage des tâches,
 * du calendrier potager, des notifications et de l'accueil.
 *
 * Refonte du 2026-10-10. L'ancien plan d'arrosage pré-générait un passage
 * tous les 2, 3 ou 5 jours de la plantation à la fin de récolte, sans saison
 * ni pluie : 17 comptes réels, 3 283 passages, 5 % notés faits, des arrosages
 * prévus tous les deux jours en janvier. Le besoin se calcule désormais chaque
 * jour depuis le bilan hydrique (`computeConseilIrrigation` : pluie passée et
 * prévue, ET0, sol, besoin de l'espèce, dernier arrosage noté), pour les
 * seules cultures cochées « à irriguer ». Noter un
 * arrosage remet le compteur à zéro ; rien n'est dû d'avance, donc rien n'est
 * « en retard » ni « périmé ».
 */

import { computeConseilIrrigation } from '@/lib/irrigation-conseil'
import { surfaceCultureM2 } from '@/lib/culture-surface'

/** Urgences qui font une ligne « à arroser » ; « moyenne » et « faible » se surveillent. */
export const URGENCES_A_ARROSER = ['critique', 'haute'] as const
export type UrgenceAArroser = (typeof URGENCES_A_ARROSER)[number]

/** Sous-ensemble d'une culture du conseil, suffisant pour décider. */
export interface CultureConseil {
  id: number
  /**
   * Opt-in « à irriguer » : seule une culture cochée fait une ligne. Le
   * conseil montre aussi les espèces exigeantes non cochées (information),
   * mais l'outil propose sans imposer (revue du 2026-10-10 : une courgette
   * en goutte-à-goutte programmé, décochée, sortait quand même en tâche et
   * en courriel).
   */
  aIrriguer: boolean | null
  urgence: string
  raisonUrgence: string
  sousAbri: boolean
  espece: { nom: string | null } | null
  planche: {
    id: string
    nom: string | null
    ilot: string | null
    surface?: number | null
    largeur?: number | null
    longueur?: number | null
  } | null
  /** Conseil du bilan (null sans météo) : L/m² à verser, efficacité du système comprise. */
  reserve?: { litresParM2: number } | null
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
  /**
   * L/m² conseillés par la culture qui pilote la ligne (null sans météo),
   * et surface sur laquelle des litres notés se répartissent : la planche,
   * sinon la culture (0 si inconnue). Préremplissent « Quantité versée »,
   * comme sur le conseiller (ticket QA cmv3japsf).
   */
  litresParM2: number | null
  surfaceM2: number
}

const RANG: Record<UrgenceAArroser, number> = { critique: 0, haute: 1 }

function estAArroser(urgence: string): urgence is UrgenceAArroser {
  return (URGENCES_A_ARROSER as readonly string[]).includes(urgence)
}

/** Regroupe par planche les cultures dont l'urgence impose un arrosage. Pur. */
export function arrosagesDuJour(cultures: CultureConseil[]): ArrosageDuJour[] {
  const groupes = new Map<string, CultureConseil[]>()
  for (const c of cultures) {
    if (c.aIrriguer !== true || !estAArroser(c.urgence)) continue
    const cle = c.planche ? `planche:${c.planche.id}` : `culture:${c.id}`
    const groupe = groupes.get(cle) ?? []
    groupe.push(c)
    groupes.set(cle, groupe)
  }

  const lignes = Array.from(groupes.entries()).map(([cle, groupe]) => {
    // Même règle de pilote que le conseiller (`grouperRecommandationsParPlanche`) :
    // la plus forte urgence, puis la plus forte dose. Mais parmi les seules
    // cultures cochées « à irriguer » : le conseiller voit toute la planche,
    // et une culture décochée (goutte-à-goutte programmé) peut y piloter un
    // autre volume.
    const tete = [...groupe].sort(
      (a, b) =>
        RANG[a.urgence as UrgenceAArroser] - RANG[b.urgence as UrgenceAArroser] ||
        (b.reserve?.litresParM2 ?? 0) - (a.reserve?.litresParM2 ?? 0),
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
      litresParM2: tete.reserve ? tete.reserve.litresParM2 : null,
      // Même surface que le chargeur des arrosages saisis (`arrosages-saisis.ts`) ;
      // sans planche, inconnue (0) : l'arrosage compte comme complet.
      surfaceM2: tete.planche ? surfaceCultureM2({ planche: tete.planche }) : 0,
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
