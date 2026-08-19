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
 * lui-même — chaque route reste maîtresse de ses réponses HTTP.
 */

import prisma from "@/lib/prisma"
import { findTreeCareProfile, generateCareOperations } from "@/lib/tree-care-calendar"

/**
 * Auto-génération du calendrier d'entretien de l'arbre qui vient d'être créé.
 *
 * Plancher = aujourd'hui : un arbre créé en juillet ne doit pas naître avec les
 * opérations de mars déjà « en retard » (elles reviendront au cycle suivant).
 * La variété est transmise pour caler la récolte, et le type de l'arbre l'est
 * aussi (ticket cmsofzh0w : un Châtaignier FORESTIER ne doit pas hériter du
 * calendrier fruitier).
 *
 * Retourne `true` si au moins une opération a été créée.
 */
export async function genererCalendrierEntretien(
  arbre: {
    id: number
    espece: string | null
    type: string
    variete: string | null
    datePlantation?: Date | null
    productif?: boolean | null
  },
  userId: string,
): Promise<boolean> {
  if (!arbre.espece) return false

  const profile = findTreeCareProfile(arbre.espece, arbre.type)
  if (!profile) return false

  const now = new Date()
  let debutJour = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  // QA cmsqmamcv — un arbre à PLANTER (date de plantation future) recevait un
  // calendrier calé sur l'année civile courante : « Récolte des pommes » et
  // « Bouillie bordelaise » ANTÉRIEURES à la mise en terre remplissaient la
  // liste « à faire » de gestes impossibles. Aucune opération ne peut précéder
  // la plantation : le plancher est repoussé à cette date.
  if (arbre.datePlantation && arbre.datePlantation > debutJour) {
    debutJour = new Date(
      arbre.datePlantation.getFullYear(),
      arbre.datePlantation.getMonth(),
      arbre.datePlantation.getDate(),
    )
  }

  let operations = generateCareOperations(
    profile, debutJour.getFullYear(), arbre.id, userId, arbre.variete, debutJour,
  )

  // Même ticket : pas de récolte planifiée sur un arbre non productif — sa
  // première année de production peut être à des années de là. L'opération
  // reviendra par la régénération du calendrier quand `productif` basculera.
  if (arbre.productif === false) {
    operations = operations.filter((op) => op.type !== "recolte")
  }

  if (operations.length === 0) return false

  await prisma.operationArbre.createMany({ data: operations })
  return true
}
