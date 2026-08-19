/**
 * Générateur d'irrigations planifiées
 * Crée automatiquement un planning d'irrigation pour les cultures actives
 * selon leur besoinEau et la rétention du sol.
 */

import prisma from '@/lib/prisma'
import { frequenceIrrigationJours } from '@/lib/irrigation-peremption'

interface GenerateResult {
  created: number
  skipped: number
  cultures: number
}

/**
 * Cultures éligibles à une planification d'arrosage : marquées « à irriguer »,
 * non terminées, sur la saison en cours ou la suivante.
 */
function whereCulturesIrrigables(userId: string, today: Date) {
  const currentYear = today.getFullYear()
  return {
    userId,
    aIrriguer: true,
    terminee: null,
    annee: { in: [currentYear, currentYear + 1] },
  }
}

/**
 * Nombre de cultures marquées « à irriguer » qui n'ont aucun passage futur
 * planifié, et pour lesquelles la génération produirait quelque chose.
 *
 * Friction constatée le 2026-07-30 : la génération n'était déclenchée que
 * lorsque le calendrier ne contenait AUCUNE irrigation. Passé le premier lot,
 * toute culture cochée ensuite restait sans plan et sans signal — 9 cultures
 * sur 12 chez le compte observé. On expose désormais ce compte pour pouvoir
 * le signaler et proposer l'action.
 */
export async function compterCulturesSansPlan(userId: string): Promise<number> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const cultures = await prisma.culture.findMany({
    where: whereCulturesIrrigables(userId, today),
    select: {
      datePlantation: true,
      dateSemis: true,
      dateRecolte: true,
      finRecolte: true,
      // Seuls les passages OUVERTS comptent comme un plan : la trace « arrosage
      // noté » du jour (clôturée à sa création) faisait passer une culture pour
      // planifiée jusqu'au lendemain — compteur à 0 aujourd'hui, N demain.
      irrigationsPlanifiees: {
        where: { datePrevue: { gte: today }, fait: false, perimee: false },
        select: { id: true },
      },
    },
  })

  return cultures.filter((culture) => {
    if (culture.irrigationsPlanifiees.length > 0) return false
    const dateDebut = culture.datePlantation || culture.dateSemis
    if (!dateDebut) return false
    // Une fin antérieure au départ ne produit aucun passage : ne pas la
    // compter, sinon le bandeau resterait affiché sans action possible.
    const dateFin = culture.finRecolte || culture.dateRecolte
    if (!dateFin) return true
    const debut = new Date(Math.max(dateDebut.getTime(), today.getTime()))
    return new Date(dateFin) > debut
  }).length
}

/**
 * Un plan d'arrosage existant SUIT les cultures : il n'attend pas un nouveau
 * clic (friction du 2026-08-14 : plan généré une fois le 30/07, les 8 cultures
 * créées ensuite n'ont jamais eu un seul passage — le bouton de l'onglet
 * Calendrier était leur seul rattrapage, et le briefing n'en parlait pas).
 *
 * Appelée après toute mutation de culture (création, dates, aIrriguer), sur
 * les chemins écran ET assistant. Deux garde-fous :
 * - opt-in : ne fait rien si le compte n'a JAMAIS de plan (aucune ligne
 *   IrrigationPlanifiee) — un compte qui n'utilise pas la planification
 *   d'arrosage ne doit pas voir son briefing se remplir de passages ;
 * - jamais bloquant : une erreur est journalisée, la mutation appelante
 *   aboutit (le plan se rattrape au prochain passage ou via le bouton).
 */
export async function etendrePlanArrosage(userId: string, cultureId: number): Promise<void> {
  try {
    const planExistant = await prisma.irrigationPlanifiee.findFirst({
      where: { userId },
      select: { id: true },
    })
    if (!planExistant) return
    await genererIrrigationsPlanifiees(userId, cultureId)
  } catch (err) {
    console.error('etendrePlanArrosage error:', err)
  }
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

  // Récupérer les cultures éligibles
  const where: any = { ...whereCulturesIrrigables(userId, today) }
  if (cultureId) where.id = cultureId

  const cultures = await prisma.culture.findMany({
    where,
    include: {
      espece: { select: { besoinEau: true } },
      // Même définition que compterCulturesSansPlan : une trace clôturée du
      // jour ne vaut pas plan, elle bloquait aussi l'extension automatique
      // (etendrePlanArrosage) jusqu'au lendemain. Le premier passage généré
      // tombe à début+fréquence, donc jamais en doublon de la trace du jour.
      irrigationsPlanifiees: {
        where: { datePrevue: { gte: today }, fait: false, perimee: false },
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

    // Cadence partagée avec la péremption : le plan et son abandon dérivent
    // de la même définition, sinon un passage pourrait périmer avant d'avoir
    // été dû (ou jamais).
    const frequenceJours = frequenceIrrigationJours(culture.espece.besoinEau)

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
