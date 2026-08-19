/**
 * Fenêtres de mise-bas projetées des campagnes de lutte (friction 2026-08-14).
 *
 * En monte naturelle de groupe, aucune saillie individuelle n'est saisie : la
 * campagne (période de lutte + espèce) est la seule donnée dont on dispose
 * pour anticiper les mises bas. Ce chargeur est la source UNIQUE des quatre
 * consommateurs — briefing quotidien, agenda élevage, calendrier élevage et
 * liste des campagnes — afin qu'ils annoncent tous la même fenêtre.
 *
 * Lecture seule ; le tri et le filtrage temporel restent aux consommateurs
 * (leurs horizons diffèrent), le volume étant de quelques campagnes par compte.
 */

import prisma from '@/lib/prisma'
import { dureeGestationEspece, fenetreMiseBasCampagne } from '@/lib/reproduction'

export interface FenetreMiseBas {
  campagneId: string
  nom: string
  typeConduite: string
  especeNom: string | null
  filiere: string | null
  /** Femelles actives de l'espèce de la campagne : ordre de grandeur du lot. */
  nbFemelles: number
  debut: Date
  fin: Date
}

export async function chargerFenetresMiseBas(
  userId: string,
  opts?: { filiere?: string | null }
): Promise<FenetreMiseBas[]> {
  const campagnes = await prisma.campagneReproduction.findMany({
    where: {
      userId,
      // Sans espèce rattachée, aucune durée de gestation n'est projetable.
      especeAnimaleId: { not: null },
      ...(opts?.filiere ? { especeAnimale: { filiere: opts.filiere } } : {}),
    },
    select: {
      id: true,
      nom: true,
      typeConduite: true,
      dateDebut: true,
      dateFin: true,
      especeAnimale: {
        select: { id: true, nom: true, type: true, filiere: true, dureeGestation: true },
      },
    },
    orderBy: { dateDebut: 'asc' },
  })

  const fenetres: FenetreMiseBas[] = []
  for (const campagne of campagnes) {
    const espece = campagne.especeAnimale
    if (!espece) continue
    const duree = dureeGestationEspece(espece)
    if (!duree) continue
    const { debut, fin } = fenetreMiseBasCampagne(campagne, duree)
    const nbFemelles = await prisma.animal.count({
      where: { userId, statut: 'actif', sexe: 'femelle', especeAnimaleId: espece.id },
    })
    fenetres.push({
      campagneId: campagne.id,
      nom: campagne.nom,
      typeConduite: campagne.typeConduite,
      especeNom: espece.nom,
      filiere: espece.filiere,
      nbFemelles,
      debut,
      fin,
    })
  }
  return fenetres
}
