/**
 * Contexte du registre phytosanitaire des traitements d'arbre RESTAURÉS
 * (import d'une sauvegarde complète du compte).
 *
 * `ObservationSante` et `OperationArbre` ne portent pas de marqueur
 * `contexte_fige` : un contexte entièrement vide y signifie « jamais figé »,
 * relu des fiches actuelles par le registre, son export et la suppression de
 * l'arbre (`contexteEstFige`). Les écrans et l'assistant n'écrivent jamais un
 * tel contexte sur un traitement, mais l'import recopie les colonnes du
 * fichier : une ligne ancienne (antérieure au figement) ou un fichier retouché
 * y arrivait vide, et son contexte était ensuite réinterprété sur la fiche du
 * moment, jusqu'à la suppression de l'arbre (contre-revue adverse, lot
 * registre-phyto-arbre-dar-contexte).
 *
 * Décision (2026-11-16, option la plus sûre sans migration) : RECALCULER à
 * l'import, dans la même transaction, le contexte d'un traitement dont les
 * trois mentions sont vides, à partir des fiches importées (arbre, parcelle,
 * zone) et au jour du traitement, exactement comme la saisie à l'écran. C'est
 * ce que le registre de l'instance d'origine affichait au moment de
 * l'export. Refuser aurait bloqué la restauration de tout compte qui a des
 * traitements antérieurs au figement. Un contexte partiellement renseigné est
 * déjà figé et reste tel quel.
 */

import type { Prisma } from "@prisma/client"
import { chargerContexteRegistre, contexteOperationTraitement } from "@/lib/tracabilite/contexte-registre"
import { METHODES_OBSERVATION_REGISTRE } from "@/lib/tracabilite/conformite-observation-phyto"

type Tx = Prisma.TransactionClient

const CONTEXTE_VIDE = { cultureRegistre: null, localisationRegistre: null, conduiteBio: null } as const

export interface ContextesRecalcules {
  observations: number
  operations: number
}

/**
 * Fige le contexte des traitements d'arbre importés (identifiants de la
 * CIBLE) dont les trois mentions sont vides. Toujours borné au compte.
 */
export async function figerContexteRegistreArbresImportes(
  tx: Tx,
  userId: string,
  ids: { observations: number[]; operations: number[] },
): Promise<ContextesRecalcules> {
  let observations = 0
  let operations = 0

  if (ids.observations.length > 0) {
    // Mêmes lignes que celles que la saisie fige (`observationAuRegistre`).
    const lignes = await tx.observationSante.findMany({
      where: {
        userId,
        id: { in: ids.observations },
        ...CONTEXTE_VIDE,
        OR: [
          { methodeTraitement: { in: [...METHODES_OBSERVATION_REGISTRE] } },
          { produit: { not: null } },
          { numAMM: { not: null } },
        ],
      },
      select: { id: true, arbreId: true, parcelleId: true, date: true },
    })
    for (const o of lignes) {
      const contexte = await chargerContexteRegistre(tx, userId, { arbreId: o.arbreId, parcelleId: o.parcelleId }, o.date)
      await tx.observationSante.update({ where: { id: o.id }, data: contexte })
      observations++
    }
  }

  if (ids.operations.length > 0) {
    // Mêmes lignes que celles que la saisie fige (`contexteOperationTraitement`).
    const lignes = await tx.operationArbre.findMany({
      where: { userId, id: { in: ids.operations }, type: "traitement", fait: true, ...CONTEXTE_VIDE },
      select: { id: true, arbreId: true, type: true, fait: true, date: true },
    })
    for (const op of lignes) {
      const contexte = await contexteOperationTraitement(tx, userId, op)
      if (!contexte) continue
      await tx.operationArbre.update({ where: { id: op.id }, data: contexte })
      operations++
    }
  }

  return { observations, operations }
}
