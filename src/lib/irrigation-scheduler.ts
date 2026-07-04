/**
 * Générateur d'irrigations planifiées
 * Crée automatiquement un planning d'irrigation pour les cultures actives
 * selon leur besoinEau et la rétention du sol.
 */

import prisma from '@/lib/prisma'

interface GenerateResult {
  created: number
  skipped: number
  cultures: number
}

/**
 * Génère les irrigations planifiées pour les cultures actives d'un utilisateur.
 * Ne crée que les irrigations futures (à partir d'aujourd'hui).
 * Ignore les cultures qui ont déjà des irrigations planifiées futures.
 *
 * @param userId - ID de l'utilisateur
 * @param cultureId - Optionnel : ne générer que pour cette culture
 */
export async function genererIrrigationsPlanifiees(
  userId: string,
  cultureId?: number
): Promise<GenerateResult> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const currentYear = today.getFullYear()

  // Récupérer les cultures éligibles
  const where: any = {
    userId,
    aIrriguer: true,
    terminee: null,
    annee: { in: [currentYear, currentYear + 1] },
  }
  if (cultureId) where.id = cultureId

  const cultures = await prisma.culture.findMany({
    where,
    include: {
      espece: { select: { besoinEau: true } },
      irrigationsPlanifiees: {
        where: { datePrevue: { gte: today } },
        select: { id: true },
      },
    },
  })

  let created = 0
  let skipped = 0

  for (const culture of cultures) {
    // Ignorer si la culture a déjà des irrigations futures
    if (culture.irrigationsPlanifiees.length > 0) {
      skipped++
      continue
    }

    const dateDebut = culture.datePlantation || culture.dateSemis
    if (!dateDebut) {
      skipped++
      continue
    }

    const besoinEau = culture.espece.besoinEau ?? 3
    // Fréquence selon besoin eau : gourmand = tous les 2j, moyen = 3j, faible = 5j
    const frequenceJours = besoinEau >= 4 ? 2 : besoinEau >= 3 ? 3 : 5

    // Date de début : max(dateDebut, today) — ne pas créer d'irrigations passées
    const startDate = new Date(Math.max(dateDebut.getTime(), today.getTime()))
    // Première irrigation : un intervalle après le début
    const currentDate = new Date(startDate)
    currentDate.setDate(currentDate.getDate() + frequenceJours)

    // Date de fin : dateRecolte ou fin de l'année de DÉBUT de culture.
    // Audit #64 : l'ancien `currentYear` empêchait toute irrigation pour une
    // culture démarrant l'année suivante (fin bornée au 31/12 de l'année courante).
    const dateFin = culture.finRecolte || culture.dateRecolte
    const endDate = dateFin ? new Date(dateFin) : new Date(startDate.getFullYear(), 11, 31)

    const irrigations: Date[] = []
    while (currentDate <= endDate) {
      irrigations.push(new Date(currentDate))
      currentDate.setDate(currentDate.getDate() + frequenceJours)
    }

    if (irrigations.length > 0) {
      await prisma.irrigationPlanifiee.createMany({
        data: irrigations.map(date => ({
          userId,
          cultureId: culture.id,
          datePrevue: date,
          fait: false,
        })),
      })
      created += irrigations.length
    }
  }

  return { created, skipped, cultures: cultures.length }
}
