/**
 * Gestes communs à toute création d'arbre, quel que soit le point d'entrée.
 *
 * Le commentaire de `POST /api/arbres` affirmait que « le plan du jardin, le
 * chat et les imports passent tous par cette route ». C'était faux pour le
 * chat : l'outil `create_arbre` de l'assistant écrit directement via
 * `prisma.arbre.create` (`src/lib/chat/executor-verger.ts`) et n'a donc jamais
 * généré de calendrier d'entretien. Constat du 2026-08-12 : rendre l'espèce
 * obligatoire à la création n'a de sens que si les DEUX chemins en tirent le
 * même effet, sinon l'assistant devient la nouvelle façon de fabriquer un
 * arbre muet.
 *
 * Ce module porte le geste partagé ; il ne valide rien et n'écrit pas l'arbre
 * lui-même — chaque route reste maîtresse de ses réponses HTTP. Il porte aussi
 * la règle du calendrier d'entretien, que la régénération réutilise.
 */

import prisma from "@/lib/prisma"
import { findTreeCareProfile, generateCareOperations, type TreeCareProfile } from "@/lib/tree-care-calendar"

export interface ArbreCalendrier {
  id: number
  variete: string | null
  datePlantation?: Date | null
  productif?: boolean | null
}

function debutDuJour(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/**
 * Jour de mise en terre, plancher de tout calendrier : aucune opération ne le
 * précède. La régénération s'en sert aussi pour retirer les opérations
 * automatiques restées avant une plantation corrigée après coup.
 */
export function jourDePlantation(datePlantation: Date | null | undefined): Date | null {
  return datePlantation ? debutDuJour(datePlantation) : null
}

/**
 * Règle UNIQUE du calendrier d'entretien d'un arbre : la création (POST,
 * duplication, assistant, via `genererCalendrierEntretien`) et la
 * régénération (`POST /api/arbres/[id]/generer-calendrier`) l'appellent.
 * Avant le 2026-10-25, la régénération recalculait à sa façon et oubliait la
 * plantation à venir et l'arbre non productif.
 *
 * - Aucune opération ne précède la plantation (QA cmsqmamcv : un arbre à
 *   planter recevait « Récolte des pommes » et « Bouillie bordelaise »
 *   antérieures à sa mise en terre).
 * - Sur l'année en cours (année non demandée, ou demandée égale), plancher =
 *   aujourd'hui : aucune opération dont la fenêtre est déjà refermée ne naît
 *   « en retard » (retour utilisateur 2026-07-31). Une fenêtre encore ouverte
 *   est créée, même si sa date conseillée est passée.
 * - Une autre année demandée explicitement est générée en entier (rattrapage
 *   historique), plantation exceptée.
 * - Pas de récolte sur un arbre non productif : sa première année de
 *   production peut être loin ; elle reviendra par la régénération quand
 *   `productif` basculera.
 *
 * Sans année demandée, l'année est celle du plancher : celle de la plantation
 * si elle est à venir, sinon l'année en cours. `maintenant` sert aux tests.
 */
export function planCalendrierEntretien(
  profile: TreeCareProfile,
  arbre: ArbreCalendrier,
  userId: string,
  options: { annee?: number | null; maintenant?: Date } = {},
): { annee: number; operations: ReturnType<typeof generateCareOperations> } {
  const aujourdhui = debutDuJour(options.maintenant ?? new Date())
  const anneeDemandee = options.annee ?? null

  let plancher: Date | null =
    anneeDemandee === null || anneeDemandee === aujourdhui.getFullYear() ? aujourdhui : null
  const plantation = jourDePlantation(arbre.datePlantation)
  if (plantation && (!plancher || plantation > plancher)) plancher = plantation

  const annee = anneeDemandee ?? (plancher ?? aujourdhui).getFullYear()
  let operations = generateCareOperations(profile, annee, arbre.id, userId, arbre.variete, plancher)
  if (arbre.productif === false) {
    operations = operations.filter((op) => op.type !== "recolte")
  }
  return { annee, operations }
}

/**
 * Auto-génération du calendrier d'entretien de l'arbre qui vient d'être créé,
 * selon `planCalendrierEntretien`. Le type de l'arbre borne le profil
 * (ticket cmsofzh0w : un Châtaignier FORESTIER ne doit pas hériter du
 * calendrier fruitier).
 *
 * Retourne `true` si au moins une opération a été créée.
 */
export async function genererCalendrierEntretien(
  arbre: ArbreCalendrier & { espece: string | null; type: string },
  userId: string,
): Promise<boolean> {
  if (!arbre.espece) return false

  const profile = findTreeCareProfile(arbre.espece, arbre.type)
  if (!profile) return false

  const { operations } = planCalendrierEntretien(profile, arbre, userId)
  if (operations.length === 0) return false

  await prisma.operationArbre.createMany({ data: operations })
  return true
}
