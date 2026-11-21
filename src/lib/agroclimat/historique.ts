/**
 * Historique climatique d'un point : lecture des années stockées de sa maille
 * SAFRAN, et demande d'import la première fois qu'on la rencontre.
 */

import prisma from "@/lib/prisma"
import { mailleLaPlusProche, type MailleSafran } from "./grille-safran"
import { ETAT_DEMANDEE, ETAT_ECHEC, ETAT_PRETE, importAgroclimatActif, importerMaillesDemandees } from "./import-safran"
import { versDegres } from "./safran"

export interface AnneeClimat {
  annee: number
  /** Minimums quotidiens en °C, 366 cases (`calendrier.ts`), `null` sans donnée. */
  tmin: (number | null)[]
  tmax: (number | null)[]
}

export type HistoriquePoint =
  /** Hors de la France métropolitaine : aucune maille. */
  | { etat: "hors_couverture" }
  /** Maille demandée, import en attente ou en cours. */
  | { etat: "en_preparation"; maille: MailleSafran }
  /** L'import a échoué ; il sera retenté la nuit suivante. */
  | { etat: "indisponible"; maille: MailleSafran }
  | { etat: "pret"; maille: MailleSafran; annees: AnneeClimat[]; actualiseLe: Date | null }

/**
 * Historique du point. Une maille inconnue est inscrite pour import, et
 * l'import est lancé en arrière-plan sans attendre le prochain passage
 * planifié : la réponse « en préparation » revient tout de suite.
 */
export async function historiqueDuPoint(lat: number, lng: number): Promise<HistoriquePoint> {
  const maille = mailleLaPlusProche(lat, lng)
  if (!maille) return { etat: "hors_couverture" }

  const cle = { lambx_lamby: { lambx: maille.lambx, lamby: maille.lamby } }
  const connue = await prisma.climatMaille.findUnique({
    where: cle,
    select: { id: true, etat: true, actualiseeLe: true },
  })

  if (!connue) {
    // Insertion atomique : une demande concurrente ne modifie pas la maille
    // déjà créée, son bail ni les années importées. Les autres erreurs remontent.
    await prisma.climatMaille.createMany({
      data: [{ lambx: maille.lambx, lamby: maille.lamby, etat: ETAT_DEMANDEE }],
      skipDuplicates: true,
    })
    lancerImportEnArrierePlan()
    return { etat: "en_preparation", maille }
  }
  if (connue.etat === ETAT_ECHEC) return { etat: "indisponible", maille }
  if (connue.etat !== ETAT_PRETE) return { etat: "en_preparation", maille }

  const annees = await prisma.climatMailleAnnee.findMany({
    where: { mailleId: connue.id },
    orderBy: { annee: "asc" },
    select: { annee: true, tmin: true, tmax: true },
  })
  return {
    etat: "pret",
    maille,
    annees: annees.map((a) => ({ annee: a.annee, tmin: versDegres(a.tmin), tmax: versDegres(a.tmax) })),
    actualiseLe: connue.actualiseeLe,
  }
}

function lancerImportEnArrierePlan(): void {
  if (!importAgroclimatActif()) return
  importerMaillesDemandees().catch((erreur) =>
    console.error("[agroclimat] Import de l'historique SAFRAN en échec:", erreur)
  )
}
