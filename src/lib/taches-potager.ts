/**
 * Tâches du potager (semis, plantations, récoltes, irrigations) sur une
 * période, avec les tâches en retard et leurs stats.
 *
 * Source unique de vérité partagée par `GET /api/taches` (page /taches,
 * dashboard maraîchage) et l'outil assistant `get_taches` — QA cmsno8277 /
 * cmsnop215 : l'assistant recomptait les retards depuis ses propres requêtes
 * (référence = début de période demandée, instants bruts, pas d'exclusion
 * d'étape, irrigations non groupées, pas de météo) et répondait « 2 tâches en
 * retard » là où l'écran en affichait 9. Règle générale du projet : tout
 * chiffre déjà affiché à l'utilisateur doit être LU par l'assistant via la
 * fonction de l'écran, jamais recalculé depuis des données brutes.
 */

import prisma from '@/lib/prisma'
import { fetchOpenMeteoForecast, fetchOpenMeteoHistory } from '@/lib/meteo'
import {
  grouperIrrigationsPlanifieesParPlancheEtJour,
  irrigationEstDue,
} from '@/lib/irrigation-planche'
import { idsAExpirer } from '@/lib/irrigation-peremption'
import {
  decideIrrigationMeteo,
  jourCivilLocalISO,
  joursCivilsAvant,
  type DecisionIrrigationMeteo,
} from '@/lib/irrigation-meteo-decision'

const CULTURE_SELECT = {
  id: true,
  especeId: true,
  varieteId: true,
  plancheId: true,
  dateSemis: true,
  datePlantation: true,
  dateRecolte: true,
  semisFait: true,
  plantationFaite: true,
  recolteFaite: true,
  espece: { select: { couleur: true, nom: true } },
  variete: { select: { nom: true } },
  planche: { select: { nom: true } },
} as const

// QA cmsjiwn48 — retard exprimé en JOURS CIVILS dans le fuseau métier (local) :
// les dates de culture sont stockées avec une heure, donc un floor brut sur les
// instants retranchait un jour (plantation du 31/07 → 7 j au lieu de 8 j au
// 08/08). On compare les journées CIVILES LOCALES — même logique que le widget
// lunaire — pour que le décompte colle à ce que l'éleveur voit à l'écran, y
// compris juste après minuit (là où l'UTC serait encore la veille).
function joursRetard(dateTask: Date, refDate: Date): number {
  const jour = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.max(0, Math.round((jour(refDate) - jour(dateTask)) / 86_400_000))
}

export interface TachesPotagerOptions {
  start: Date
  end: Date
  annee: number
  /**
   * Le chemin écran (GET /api/taches) auto-valide en base les irrigations
   * dues couvertes par la pluie récente. Le chemin assistant reste en
   * lecture pure : passer `false` conserve le même décompte (l'irrigation
   * est marquée faite en mémoire) sans écrire.
   */
  persistAutoValidation?: boolean
}

export async function getTachesPotager(
  userId: string,
  { start, end, annee, persistAutoValidation = true }: TachesPotagerOptions
) {
  const currentYear = new Date().getFullYear()

  // Les retards historiques restent utiles dans la saison courante (audit
  // #49), mais ils ne doivent pas contaminer une saison passée ou future
  // explicitement sélectionnée. Exemple : le calendrier 2027 ne doit pas
  // afficher les tâches 2026 encore ouvertes.
  const retardAnneeFilter = annee === currentYear ? {} : { annee }

  // ── Tâches de la semaine + tâches en retard (non faites, date passée) ──

  // Audit Marc 2026-05-14 — Bug 06 : une culture "En récolte" affichait
  // "Semis à faire 10 sem. en retard" parce que la query ne regardait que
  // semisFait. Désormais on exclut les cultures dont l'état a déjà
  // dépassé le semis (plantationFaite / recolteFaite / terminee).

  // Semis : cette semaine OU en retard
  const [semisSemaine, semisRetard] = await Promise.all([
    prisma.culture.findMany({
      where: { userId, annee, dateSemis: { gte: start, lte: end } },
      select: CULTURE_SELECT,
      orderBy: { dateSemis: 'asc' },
    }),
    prisma.culture.findMany({
      where: {
        userId,
        ...retardAnneeFilter,
        semisFait: false,
        plantationFaite: false,
        recolteFaite: false,
        terminee: null,
        dateSemis: { lt: start, not: null },
      },
      select: CULTURE_SELECT,
      orderBy: { dateSemis: 'asc' },
    }),
  ])

  // Plantations : cette semaine OU en retard
  const [plantationsSemaine, plantationsRetard] = await Promise.all([
    prisma.culture.findMany({
      where: { userId, annee, datePlantation: { gte: start, lte: end } },
      select: CULTURE_SELECT,
      orderBy: { datePlantation: 'asc' },
    }),
    prisma.culture.findMany({
      where: {
        userId,
        ...retardAnneeFilter,
        plantationFaite: false,
        recolteFaite: false,
        terminee: null,
        datePlantation: { lt: start, not: null },
      },
      select: CULTURE_SELECT,
      orderBy: { datePlantation: 'asc' },
    }),
  ])

  // Récoltes : cette semaine OU en retard
  const [recoltesSemaine, recoltesRetard] = await Promise.all([
    prisma.culture.findMany({
      where: { userId, annee, dateRecolte: { gte: start, lte: end } },
      select: CULTURE_SELECT,
      orderBy: { dateRecolte: 'asc' },
    }),
    prisma.culture.findMany({
      where: {
        userId,
        ...retardAnneeFilter,
        recolteFaite: false,
        terminee: null,
        dateRecolte: { lt: start, not: null },
      },
      select: CULTURE_SELECT,
      orderBy: { dateRecolte: 'asc' },
    }),
  ])

  // Irrigations : cette semaine OU en retard
  const irrigationInclude = {
    culture: {
      select: {
        id: true,
        especeId: true,
        plancheId: true,
        espece: { select: { couleur: true, nom: true, besoinEau: true } },
        planche: {
          select: {
            nom: true,
            ilot: true,
            parcelleGeo: {
              select: { centroidLat: true, centroidLng: true },
            },
          },
        },
      },
    },
  } as const

  // Bug #18 — Les irrigations n'étaient pas scopées à l'année sélectionnée,
  // donc le KPI "Cette semaine" affichait 23 même quand on basculait sur
  // 2024 ou 2027 (sans aucune culture sur cette année). On filtre via la
  // culture pour rester cohérent avec les sub-totaux Semis/Plantations/Récoltes.
  const [irrigationsSemaineBrutes, irrigationsRetardBrutes] = await Promise.all([
    prisma.irrigationPlanifiee.findMany({
      where: {
        userId,
        fait: false,
        perimee: false,
        datePrevue: { gte: start, lte: end },
        culture: { annee },
      },
      include: irrigationInclude,
      orderBy: { datePrevue: 'asc' },
    }),
    prisma.irrigationPlanifiee.findMany({
      where: {
        userId,
        fait: false,
        perimee: false,
        datePrevue: { lt: start },
        culture: { annee },
      },
      include: irrigationInclude,
      orderBy: { datePrevue: 'asc' },
    }),
  ])

  // ── Péremption : un passage manqué de plus d'un cycle est abandonné ──
  // Un arrosage ne se rattrape pas. Sans cette règle, le plan de saison
  // accumulait un retard indéfini : « 19 en retard, échéance 09/08 » chez un
  // maraîcher quotidien le 2026-08-14, soldés d'un clic par planche qui
  // antidatait la trace. Filtré AVANT la météo : on ne paie pas de prévision
  // pour un passage qu'on abandonne.
  const referencePeremption = new Date()
  const idsPerimes = new Set(
    idsAExpirer([...irrigationsSemaineBrutes, ...irrigationsRetardBrutes], referencePeremption)
  )
  if (persistAutoValidation && idsPerimes.size > 0) {
    await prisma.irrigationPlanifiee.updateMany({
      where: { id: { in: Array.from(idsPerimes) } },
      data: { perimee: true },
    })
  }
  const nonPerimee = (irr: { id: number }) => !idsPerimes.has(irr.id)
  const irrigationsSemaine = irrigationsSemaineBrutes.filter(nonPerimee)
  const irrigationsRetard = irrigationsRetardBrutes.filter(nonPerimee)

  // ── Prévisions météo pour les irrigations ──
  const allIrrigations = [...irrigationsSemaine, ...irrigationsRetard]

  // Coordonnées : d'abord depuis la parcelle de la planche, sinon fallback user
  let fallbackCoords: { lat: number; lng: number } | null = null
  if (allIrrigations.length > 0) {
    // Charger un fallback dès qu'AU MOINS une planche n'a pas de
    // coordonnées. L'ancien test ne le faisait que si aucune planche
    // n'était géolocalisée : dans un lot mixte, toutes les planches non
    // rattachées perdaient silencieusement l'intégration météo.
    const manqueCoordonnees = allIrrigations.some((irr) => {
      const lat = irr.culture.planche?.parcelleGeo?.centroidLat
      const lng = irr.culture.planche?.parcelleGeo?.centroidLng
      return !lat || !lng
    })

    if (manqueCoordonnees) {
      const userParcelle = await prisma.parcelleGeo.findFirst({
        where: { userId },
        select: { centroidLat: true, centroidLng: true },
      })
      if (userParcelle?.centroidLat && userParcelle?.centroidLng) {
        fallbackCoords = { lat: userParcelle.centroidLat, lng: userParcelle.centroidLng }
      }
    }
  }

  // Regrouper par coordonnées uniques
  const coordsMap = new Map<string, { lat: number; lng: number }>()
  for (const irr of allIrrigations) {
    const lat = irr.culture.planche?.parcelleGeo?.centroidLat ?? fallbackCoords?.lat
    const lng = irr.culture.planche?.parcelleGeo?.centroidLng ?? fallbackCoords?.lng
    if (!lat || !lng) continue
    const key = `${Math.round(lat * 100)}_${Math.round(lng * 100)}`
    if (!coordsMap.has(key)) coordsMap.set(key, { lat, lng })
  }

  // Fetch prévisions + historique récent pour chaque jeu de coordonnées unique
  const precipByCoordAndDate = new Map<string, Map<string, number>>()
  const pluieRecente3jByCoord = new Map<string, number>() // Pluie cumulée 3 derniers jours + aujourd'hui
  const et0RecenteByCoord = new Map<string, number | null>() // ET0 moyenne journalière récente

  await Promise.all(
    Array.from(coordsMap.entries()).map(async ([coordKey, { lat, lng }]) => {
      try {
        const forecast = await fetchOpenMeteoForecast(lat, lng)
        const dateMap = new Map<string, number>()
        for (const day of forecast.daily) {
          dateMap.set(day.date, day.precipitation)
        }
        precipByCoordAndDate.set(coordKey, dateMap)

        // Historique 3 derniers jours
        const today = new Date()
        const j3 = new Date(today)
        j3.setDate(j3.getDate() - 3)
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)

        const historique = await fetchOpenMeteoHistory(
          lat, lng,
          j3.toISOString().split('T')[0],
          yesterday.toISOString().split('T')[0]
        )
        const pluieHisto = historique.reduce((s, d) => s + d.precipitation, 0)
        const pluieAujourdhui = forecast.daily[0]?.precipitation ?? 0
        pluieRecente3jByCoord.set(coordKey, pluieHisto + pluieAujourdhui)
        const et0Hist = historique.length > 0
          ? historique.reduce((s, d) => s + d.et0, 0) / historique.length
          : null
        et0RecenteByCoord.set(coordKey, et0Hist ?? forecast.daily[0]?.et0 ?? null)
      } catch {
        // En cas d'erreur météo, on n'enrichit pas (pas bloquant)
      }
    })
  )

  // Décision « probablement inutile » : règle partagée avec /api/calendrier
  // (QA cmswu3260 — seuils et cause dans irrigation-meteo-decision.ts).
  function getIrrigationMeteo(irr: typeof allIrrigations[number]): DecisionIrrigationMeteo {
    const lat = irr.culture.planche?.parcelleGeo?.centroidLat ?? fallbackCoords?.lat
    const lng = irr.culture.planche?.parcelleGeo?.centroidLng ?? fallbackCoords?.lng
    if (!lat || !lng) {
      return { pluiePrevue: null, pluieRecente: 0, probablementInutile: false, raisonInutile: null }
    }
    const coordKey = `${Math.round(lat * 100)}_${Math.round(lng * 100)}`

    return decideIrrigationMeteo({
      pluiePrevueJour: precipByCoordAndDate.get(coordKey)?.get(jourCivilLocalISO(irr.datePrevue)) ?? null,
      pluieRecente: pluieRecente3jByCoord.get(coordKey) ?? 0,
      et0MoyenneJournaliere: et0RecenteByCoord.get(coordKey) ?? null,
      joursAvant: joursCivilsAvant(irr.datePrevue),
    })
  }

  // ── Formatter ──

  function formatSemis(c: typeof semisSemaine[number], retard: number) {
    return {
      id: c.id,
      type: 'semis' as const,
      especeId: c.especeId,
      especeNom: c.espece?.nom ?? c.especeId,
      varieteId: c.varieteId,
      varieteNom: c.variete?.nom ?? c.varieteId,
      plancheId: c.planche?.nom || null,
      date: c.dateSemis?.toISOString() || '',
      fait: c.semisFait,
      couleur: c.espece?.couleur || null,
      retardJours: retard,
    }
  }

  function formatPlantation(c: typeof plantationsSemaine[number], retard: number) {
    return {
      id: c.id,
      type: 'plantation' as const,
      especeId: c.especeId,
      especeNom: c.espece?.nom ?? c.especeId,
      varieteId: c.varieteId,
      varieteNom: c.variete?.nom ?? c.varieteId,
      plancheId: c.planche?.nom || null,
      date: c.datePlantation?.toISOString() || '',
      fait: c.plantationFaite,
      couleur: c.espece?.couleur || null,
      retardJours: retard,
    }
  }

  function formatRecolte(c: typeof recoltesSemaine[number], retard: number) {
    return {
      id: c.id,
      type: 'recolte' as const,
      especeId: c.especeId,
      especeNom: c.espece?.nom ?? c.especeId,
      varieteId: c.varieteId,
      varieteNom: c.variete?.nom ?? c.varieteId,
      plancheId: c.planche?.nom || null,
      date: c.dateRecolte?.toISOString() || '',
      fait: c.recolteFaite,
      couleur: c.espece?.couleur || null,
      retardJours: retard,
    }
  }

  // Auto-valider les irrigations passées ou du jour couvertes par la pluie
  // récente. Le marquage en mémoire (irr.fait = true) est conservé dans tous
  // les cas pour que le décompte reste identique entre l'écran et l'assistant.
  const autoValidIds: number[] = []
  for (const irr of allIrrigations) {
    if (irr.fait) continue
    const meteo = getIrrigationMeteo(irr)
    if (irrigationEstDue(irr.datePrevue) && meteo.probablementInutile) {
      autoValidIds.push(irr.id)
      irr.fait = true
    }
  }
  if (persistAutoValidation && autoValidIds.length > 0) {
    await prisma.irrigationPlanifiee.updateMany({
      where: { id: { in: autoValidIds } },
      data: { fait: true, notes: 'Auto-validée (pluie suffisante)' },
    })
  }

  // QA cmsjiwn48 — le retard était mesuré depuis `start` (le lundi de la
  // semaine affichée) et non depuis aujourd'hui : une plantation prévue le
  // 31/07 affichait « 2 j » au 08/08 au lieu de 8 j. Le nombre de jours de
  // retard doit se compter par rapport au jour courant, quelle que soit la
  // semaine visualisée.
  const refRetard = new Date()
  refRetard.setHours(0, 0, 0, 0)

  // Tâches en retard en premier, puis tâches de la semaine
  const semis = [
    ...semisRetard.map(c => formatSemis(c, joursRetard(c.dateSemis!, refRetard))),
    ...semisSemaine.map(c => formatSemis(c, 0)),
  ]

  const plantations = [
    ...plantationsRetard.map(c => formatPlantation(c, joursRetard(c.datePlantation!, refRetard))),
    ...plantationsSemaine.map(c => formatPlantation(c, 0)),
  ]

  const recoltes = [
    ...recoltesRetard.map(c => formatRecolte(c, joursRetard(c.dateRecolte!, refRetard))),
    ...recoltesSemaine.map(c => formatRecolte(c, 0)),
  ]

  function formatIrrigation(i: typeof irrigationsSemaine[number], retard: number) {
    const meteo = getIrrigationMeteo(i)
    return {
      id: i.id,
      cultureId: i.culture.id,
      especeId: i.culture.especeId,
      especeNom: i.culture.espece?.nom ?? i.culture.especeId,
      plancheId: i.culture.planche?.nom || null,
      ilot: i.culture.planche?.ilot || null,
      datePrevue: i.datePrevue.toISOString(),
      fait: i.fait,
      couleur: i.culture.espece?.couleur || null,
      retardJours: retard,
      pluiePrevue: meteo.pluiePrevue !== null ? Math.round(meteo.pluiePrevue * 10) / 10 : null,
      pluieRecente: Math.round(meteo.pluieRecente * 10) / 10,
      probablementInutile: meteo.probablementInutile,
      raisonInutile: meteo.raisonInutile,
    }
  }

  const irrigation = grouperIrrigationsPlanifieesParPlancheEtJour([
    ...irrigationsRetard.map(i => formatIrrigation(i, joursRetard(i.datePrevue, refRetard))),
    ...irrigationsSemaine.map(i => formatIrrigation(i, 0)),
  ])

  const enRetardTotal =
    semisRetard.length +
    plantationsRetard.length +
    recoltesRetard.length +
    irrigation.filter((item) => item.retardJours > 0 && !item.fait).length

  return {
    semis,
    plantations,
    recoltes,
    irrigation,
    stats: {
      semisPrevus: semis.length,
      semisFaits: semis.filter(s => s.fait).length,
      plantationsPrevues: plantations.length,
      plantationsFaites: plantations.filter(p => p.fait).length,
      recoltesPrevues: recoltes.length,
      recoltesFaites: recoltes.filter(r => r.fait).length,
      aIrriguer: irrigation.filter(
        (item) => !item.fait && !item.probablementInutile
      ).length,
      enRetard: enRetardTotal,
    },
  }
}

export type TachesPotager = Awaited<ReturnType<typeof getTachesPotager>>
