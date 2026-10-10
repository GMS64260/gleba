/**
 * Conseil d'irrigation météo-aware — calcul partagé.
 *
 * Source de vérité unique du module Irrigation (page Cultures > Irrigation)
 * ET de l'assistant IA (tool get_conseil_irrigation) : les deux doivent
 * afficher les mêmes litres/urgences pour une même culture.
 *
 * L'urgence est calculée à partir du bilan hydrique réel :
 *  - Précipitations des 7 derniers jours (Open-Meteo archive)
 *  - Prévisions 7 jours (Open-Meteo forecast)
 *  - Évapotranspiration (ET0) réelle
 *  - Rétention du sol, besoin eau de l'espece
 *
 * Lecture pure depuis la refonte du 2026-10-10 : il n'existe plus de passages
 * planifiés à clore quand il pleut. L'urgence alimente les lignes « à
 * arroser » (`src/lib/irrigation/a-arroser.ts`).
 */

import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { fetchOpenMeteoForecast, fetchOpenMeteoHistory } from '@/lib/meteo'
import type { MeteoJournaliere, MeteoPrevision } from '@/lib/meteo'
import {
  getIrrigationFactors,
  calculerConsommationEauAvecSol,
  calculerConsommationEauAvecMeteo,
  alerteSecheresse,
} from '@/lib/soil-quality'
import { cultureIrrigationDemarreeWhere } from '@/lib/irrigation-eligibility'
import { surfaceCultureM2 } from '@/lib/culture-surface'
import { consommationHebdoTotale } from '@/lib/irrigation/consommation'

// ── Types internes ──────────────────────────────────────────

interface MeteoParCoord {
  lat: number
  lng: number
  historique: MeteoJournaliere[]
  previsions: MeteoPrevision[]
  pluie48hPassees: number  // mm cumulés hier + avant-hier
  pluie7jPassees: number   // mm cumulés 7 derniers jours
  et0_7j: number           // mm ET0 cumulés 7j
  joursSansPluie: number   // jours consécutifs sans pluie (depuis le plus récent)
  pluiePrevue48h: number   // mm prévus dans les 48h
  pluiePrevue5j: number    // mm prévus dans les 5 prochains jours
  joursAvantPluie: number  // nb jours avant prochaine pluie significative (>3mm)
}

const TYPES_SOUS_ABRI = ['Serre', 'Tunnel', 'Châssis', 'Chassis']

// ── Seuils ──────────────────────────────────────────────────

/** Mm de pluie cumulés sur 48h pour considérer que le sol est suffisamment arrosé */
const SEUIL_PLUIE_SOL_ARROSE = 8

// Seuils partagés avec le conseiller du Calendrier (meteo-agro.ts).
import {
  DEFICIT_CRITIQUE_MM,
  DEFICIT_HAUTE_MM,
  DEFICIT_MOYENNE_MM,
  JOURS_APRES_DEBUT_RECOLTE_SANS_FIN,
  JOURS_APRES_FIN_RECOLTE,
  SEUIL_PLUIE_SIGNIFICATIVE,
} from '@/lib/irrigation/seuils'
export { DEFICIT_CRITIQUE_MM, DEFICIT_HAUTE_MM, JOURS_APRES_FIN_RECOLTE, SEUIL_PLUIE_SIGNIFICATIVE }

/** Nb de jours couverts par la pluie selon la rétention du sol */
function joursCouverts(pluieMm: number, retentionEau: string | null, et0Journalier: number): number {
  // Combien de jours d'ETc sont couverts par la pluie reçue ?
  // On considère 80% de la pluie comme efficace (le reste ruisselle)
  const pluieEfficace = pluieMm * 0.8
  if (et0Journalier <= 0) return 7 // Pas d'évaporation → longtemps

  const factors = getIrrigationFactors(retentionEau || 'Moyenne')
  // ETc ≈ ET0 × 0.8 (coeff moyen) × facteur sol
  const etcJournalier = et0Journalier * 0.8 * factors.quantiteFactor

  const jours = Math.floor(pluieEfficace / etcJournalier)

  // Clamp selon rétention : sol sableux perd vite, argileux conserve
  const maxJours = retentionEau === 'Faible' ? 4
    : retentionEau === 'Élevée' ? 8
    : 6

  return Math.min(jours, maxJours)
}

// ── Calcul urgence météo ────────────────────────────────────

type Urgence = 'critique' | 'haute' | 'moyenne' | 'faible' | 'aucune'

export function calculerUrgenceMeteo(
  joursSansArrosage: number | null,
  besoinEau: number,
  retentionEau: string | null,
  meteo: MeteoParCoord | null,
  sousAbri: boolean
): { urgence: Urgence; raison: string } {
  // Pas de données météo → fallback simple
  if (!meteo) {
    return urgenceFallback(joursSansArrosage, besoinEau, retentionEau)
  }

  const factors = getIrrigationFactors(retentionEau || 'Moyenne')
  const besoinNorm = besoinEau / 5 // 0–1

  // Pluie effective (sous abri = 0)
  const pluie7j = sousAbri ? 0 : meteo.pluie7jPassees
  const pluie48h = sousAbri ? 0 : meteo.pluie48hPassees
  const pluiePrevue48h = sousAbri ? 0 : meteo.pluiePrevue48h
  const pluiePrevue5j = sousAbri ? 0 : meteo.pluiePrevue5j
  const joursSansPluie = sousAbri ? 999 : meteo.joursSansPluie

  // Bilan hydrique 7j
  const etc7j = meteo.et0_7j * (0.6 + besoinNorm * 0.6) * factors.quantiteFactor
  const bilanHydrique = pluie7j - etc7j

  // ── Cas favorable : beaucoup de pluie récente ──
  // S'il a plu > seuil ces dernières 48h et qu'il y a encore de la pluie prévue
  if (pluie48h >= SEUIL_PLUIE_SOL_ARROSE) {
    const et0Moy = meteo.et0_7j / Math.max(meteo.historique.length, 1)
    const joursCouv = joursCouverts(pluie48h, retentionEau, et0Moy)

    if (pluiePrevue5j >= 5) {
      return {
        urgence: 'aucune',
        raison: `${Math.round(pluie48h)}mm de pluie ces 2 derniers jours + ${Math.round(pluiePrevue5j)}mm prévus. Aucun arrosage necessaire.`,
      }
    }
    if (joursCouv >= 3) {
      return {
        urgence: 'aucune',
        raison: `${Math.round(pluie48h)}mm de pluie ces 2 derniers jours — sol couvert pour ~${joursCouv} jours.`,
      }
    }
  }

  // ── Pluie récente modérée ──
  if (pluie7j >= 15 && bilanHydrique > 0) {
    return {
      urgence: 'aucune',
      raison: `Bilan hydrique positif (+${Math.round(bilanHydrique)}mm). ${Math.round(pluie7j)}mm de pluie en 7j.`,
    }
  }

  // ── Pluie significative prevue dans les 5j ──
  const bilanProspectif = bilanHydrique + pluiePrevue5j
  if (pluiePrevue5j >= 15 && bilanProspectif > 0) {
    return {
      urgence: 'aucune',
      raison: `${Math.round(pluiePrevue5j)}mm de pluie prévus dans les 5 prochains jours — déficit comblé.`,
    }
  }
  if (pluiePrevue5j >= 10) {
    return {
      urgence: bilanProspectif > -5 ? 'faible' : 'moyenne',
      raison: `${Math.round(pluiePrevue5j)}mm de pluie prévus dans les 5 prochains jours.${bilanProspectif > -5 ? ' Arrosage léger suffisant.' : ''}`,
    }
  }

  // ── Pluie prevue imminente ──
  if (pluiePrevue48h >= 10) {
    if (bilanHydrique > -10) {
      return {
        urgence: 'faible',
        raison: `${Math.round(pluiePrevue48h)}mm de pluie prévus dans 48h — reporter l'arrosage.`,
      }
    }
  }

  // ── Calcul déficit ──
  const deficit = Math.abs(Math.min(0, bilanHydrique)) * factors.urgenceFactor

  // Prendre en compte le temps depuis le dernier arrosage OU la dernière pluie significative
  const joursEffectifsSansEau = Math.min(
    joursSansArrosage ?? 999,
    joursSansPluie
  )

  // ── Seuils dynamiques ──
  if (deficit > DEFICIT_CRITIQUE_MM && joursEffectifsSansEau >= 5 && pluiePrevue48h < 5 && pluiePrevue5j < 8) {
    return {
      urgence: 'critique',
      raison: `Déficit hydrique de ${Math.round(deficit)}mm. ${joursEffectifsSansEau}j sans eau. Pas de pluie prévue.`,
    }
  }

  if (deficit > DEFICIT_HAUTE_MM && joursEffectifsSansEau >= 3 && pluiePrevue48h < 8 && pluiePrevue5j < 10) {
    return {
      urgence: 'haute',
      raison: `Déficit de ${Math.round(deficit)}mm, ${joursEffectifsSansEau}j sans eau.${pluiePrevue48h > 0 ? ` ${Math.round(pluiePrevue48h)}mm prévus.` : ''}`,
    }
  }

  if (deficit > DEFICIT_MOYENNE_MM && joursEffectifsSansEau > 2) {
    return {
      urgence: 'moyenne',
      raison: `Déficit modéré (${Math.round(deficit)}mm). ${joursEffectifsSansEau}j sans eau.`,
    }
  }

  if (bilanHydrique < 0) {
    return {
      urgence: 'faible',
      raison: `Léger déficit (${Math.round(Math.abs(bilanHydrique))}mm). Surveiller.`,
    }
  }

  return {
    urgence: 'aucune',
    raison: `Bilan hydrique OK (+${Math.round(bilanHydrique)}mm).`,
  }
}

/**
 * Sans coordonnées de parcelle, pas de bilan hydrique : on ne sait pas s'il a
 * plu. Revue du 2026-10-10 : l'ancien compteur de jours rendait « critique »
 * tous les 3 à 4 jours, été comme hiver (le défaut du plan supprimé). Le
 * conseil plafonne donc à « moyenne » (à surveiller, jamais une tâche) et
 * invite à géolocaliser une parcelle.
 */
function urgenceFallback(
  joursSansEau: number | null,
  besoinEau: number,
  retentionEau: string | null
): { urgence: Urgence; raison: string } {
  const conseil = 'Géolocalisez une parcelle pour un conseil météo.'
  if (joursSansEau === null) {
    return { urgence: 'moyenne', raison: `Jamais arrosé, pas de données météo. ${conseil}` }
  }
  const factors = getIrrigationFactors(retentionEau || 'Moyenne')
  const seuil = besoinEau >= 4 ? 2 : 3
  if (joursSansEau * factors.urgenceFactor >= seuil) {
    return { urgence: 'moyenne', raison: `${joursSansEau}j sans arrosage, pas de données météo. ${conseil}` }
  }
  return { urgence: 'faible', raison: 'Arrosé récemment.' }
}

// ── Calcul complet ──────────────────────────────────────────

export type ConseilIrrigation = Awaited<ReturnType<typeof computeConseilIrrigation>>

/**
 * Cultures réellement en place à arroser (revue du 2026-10-10) :
 * - une vivace non terminée, quelle que soit son année ;
 * - une annuelle de la saison ou de la précédente (un poireau d'hiver semé en
 *   2026 est encore en terre en janvier 2027), dont la fenêtre de récolte
 *   n'est pas finie depuis plus de JOURS_APRES_FIN_RECOLTE jours (sans fin
 *   connue : JOURS_APRES_DEBUT_RECOLTE_SANS_FIN jours après son début), ou
 *   sans date de récolte. 12 % des cultures retenues le 2026-10-10 avaient fini
 *   leur récolte sans être clôturées : elles sortaient « à arroser ».
 */
export function whereCulturesEnPlace(annee: number, maintenant: Date = new Date()): Prisma.CultureWhereInput {
  const borne = new Date(maintenant.getTime() - JOURS_APRES_FIN_RECOLTE * 86_400_000)
  const borneSansFin = new Date(maintenant.getTime() - JOURS_APRES_DEBUT_RECOLTE_SANS_FIN * 86_400_000)
  return {
    AND: [
      { OR: [{ espece: { vivace: true } }, { annee: { in: [annee - 1, annee] } }] },
      {
        OR: [
          { espece: { vivace: true } },
          { dateRecolte: null, finRecolte: null },
          { finRecolte: { gte: borne } },
          // Sans fin de récolte, `dateRecolte` n'en est que le début.
          { finRecolte: null, dateRecolte: { gte: borneSansFin } },
        ],
      },
    ],
  }
}

export async function computeConseilIrrigation(userId: string, annee: number) {
  // 1. Récupérer cultures actives avec planches + coordonnées parcelle
  const cultures = await prisma.culture.findMany({
    where: {
      userId,
      terminee: null,
      AND: [
        whereCulturesEnPlace(annee),
        cultureIrrigationDemarreeWhere,
        {
          OR: [
            { aIrriguer: true },
            {
              espece: {
                OR: [
                  { besoinEau: { gte: 3 } },
                  { irrigation: 'Eleve' },
                ],
              },
            },
          ],
        },
      ],
    },
    select: {
      id: true,
      especeId: true,
      varieteId: true,
      plancheId: true,
      aIrriguer: true,
      derniereIrrigation: true,
      plantationFaite: true,
      semisFait: true,
      dateSemis: true,
      datePlantation: true,
      nbRangs: true,
      longueur: true,
      espece: {
        select: {
          id: true,
          nom: true,
          couleur: true,
          besoinEau: true,
          irrigation: true,
        },
      },
      planche: {
        select: {
          id: true,
          nom: true,
          ilot: true,
          type: true,
          irrigation: true,
          surface: true,
          largeur: true,
          longueur: true,
          retentionEau: true,
          typeSol: true,
          parcelleGeo: {
            select: {
              id: true,
              centroidLat: true,
              centroidLng: true,
            },
          },
        },
      },
      variete: {
        select: {
          id: true,
        },
      },
    },
    orderBy: [
      { planche: { ilot: 'asc' } },
      { planche: { id: 'asc' } },
    ],
  })

  // 2. Regrouper par coordonnées parcelle → fetch météo 1x par zone
  //    Fallback : si une culture n'a pas de parcelle géo, utiliser la première
  //    parcelle de l'utilisateur avec des coordonnées
  const meteoParCoord = new Map<string, MeteoParCoord>()
  const cultureCoordKey = new Map<number, string>() // cultureId → coordKey

  // Fallback coords : première parcelle géo de l'utilisateur
  let fallbackLat: number | null = null
  let fallbackLng: number | null = null

  const premiereParcelle = await prisma.parcelleGeo.findFirst({
    where: { userId, centroidLat: { not: null }, centroidLng: { not: null } },
    select: { centroidLat: true, centroidLng: true },
  })
  if (premiereParcelle?.centroidLat && premiereParcelle?.centroidLng) {
    fallbackLat = premiereParcelle.centroidLat
    fallbackLng = premiereParcelle.centroidLng
  }

  for (const c of cultures) {
    let lat = c.planche?.parcelleGeo?.centroidLat
    let lng = c.planche?.parcelleGeo?.centroidLng

    // Fallback si pas de coordonnées sur la planche
    if ((!lat || !lng) && fallbackLat && fallbackLng) {
      lat = fallbackLat
      lng = fallbackLng
    }

    if (!lat || !lng) continue

    const key = `${Math.round(lat * 100)}_${Math.round(lng * 100)}`
    cultureCoordKey.set(c.id, key)

    if (!meteoParCoord.has(key)) {
      meteoParCoord.set(key, {
        lat, lng,
        historique: [], previsions: [],
        pluie48hPassees: 0, pluie7jPassees: 0, et0_7j: 0,
        joursSansPluie: 0, pluiePrevue48h: 0, pluiePrevue5j: 0,
        joursAvantPluie: 99,
      })
    }
  }

  // 3. Fetch météo pour chaque zone (en parallèle)
  await Promise.all(
    Array.from(meteoParCoord.entries()).map(async ([key, entry]) => {
      try {
        const today = new Date()
        const weekAgo = new Date(today)
        weekAgo.setDate(weekAgo.getDate() - 8)
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)

        const [historique, forecastData] = await Promise.all([
          fetchOpenMeteoHistory(
            entry.lat, entry.lng,
            weekAgo.toISOString().split('T')[0],
            yesterday.toISOString().split('T')[0]
          ),
          fetchOpenMeteoForecast(entry.lat, entry.lng),
        ])

        const previsions = forecastData.daily

        // Le forecast inclut aujourd'hui (jour 0). L'archive s'arrête à hier.
        // On intègre la pluie du jour en cours (forecast[0]) dans les calculs passés.
        const pluieAujourdhui = previsions.length > 0 ? previsions[0].precipitation : 0
        const et0Aujourdhui = previsions.length > 0 ? previsions[0].et0 : 0

        // Pluie cumulée : hier + avant-hier + aujourd'hui (forecast)
        const derniers2jArchive = historique.slice(-2)
        const pluie48hPassees = derniers2jArchive.reduce((s, d) => s + d.precipitation, 0) + pluieAujourdhui

        // Pluie cumulée 7j = historique + aujourd'hui
        const pluie7jPassees = historique.reduce((s, d) => s + d.precipitation, 0) + pluieAujourdhui

        // ET0 cumulée 7j + aujourd'hui
        const et0_7j = historique.reduce((s, d) => s + d.et0, 0) + et0Aujourdhui

        // Jours consécutifs sans pluie significative (>1mm)
        // Si aujourd'hui il pleut, joursSansPluie = 0
        let joursSansPluie = 0
        if (pluieAujourdhui >= SEUIL_PLUIE_SIGNIFICATIVE) {
          joursSansPluie = 0
        } else {
          joursSansPluie = 1 // au moins aujourd'hui
          for (let i = historique.length - 1; i >= 0; i--) {
            if (historique[i].precipitation < SEUIL_PLUIE_SIGNIFICATIVE) joursSansPluie++
            else break
          }
        }

        // Pluie prevue demain + après-demain (aujourd'hui est déjà compté dans pluie48hPassees)
        const pluiePrevue48h = previsions.slice(1, 3).reduce((s, d) => s + d.precipitation, 0)

        // Pluie prevue 5 prochains jours (hors aujourd'hui)
        const pluiePrevue5j = previsions.slice(1, 6).reduce((s, d) => s + d.precipitation, 0)

        // Jours avant prochaine pluie significative (>3mm), à partir de demain
        let joursAvantPluie = 99
        for (let i = 1; i < previsions.length; i++) {
          if (previsions[i].precipitation >= SEUIL_PLUIE_SIGNIFICATIVE) {
            joursAvantPluie = i
            break
          }
        }

        meteoParCoord.set(key, {
          lat: entry.lat, lng: entry.lng,
          historique, previsions,
          pluie48hPassees, pluie7jPassees, et0_7j,
          joursSansPluie, pluiePrevue48h, pluiePrevue5j, joursAvantPluie,
        })
      } catch (err) {
        console.error(`Erreur météo pour zone ${key}:`, err)
        // On garde les valeurs par défaut (0) — fallback sans météo
      }
    })
  )

  // 5. Calculer urgence + enrichir chaque culture
  const now = Date.now()
  const culturesAvecUrgence = cultures.map(c => {
    let joursSansEau: number | null = null
    if (c.derniereIrrigation) {
      joursSansEau = Math.floor((now - new Date(c.derniereIrrigation).getTime()) / (1000 * 60 * 60 * 24))
    }

    // Âge depuis plantation/semis
    const dateReference = c.datePlantation || c.dateSemis
    let ageJours: number | null = null
    let isJeune = false
    if (dateReference) {
      ageJours = Math.floor((now - new Date(dateReference).getTime()) / (1000 * 60 * 60 * 24))
      isJeune = ageJours < 14
    }

    // Surface
    const surface = surfaceCultureM2(c)

    const besoinEau = c.espece?.besoinEau || 3
    const retentionEauSol = c.planche?.retentionEau || null
    const sousAbri = TYPES_SOUS_ABRI.includes(c.planche?.type ?? '')

    // Météo pour cette culture
    const coordKey = cultureCoordKey.get(c.id)
    const meteo = coordKey ? meteoParCoord.get(coordKey) ?? null : null

    // Consommation estimée — météo-aware si possible
    let consommationSemaine: number
    if (meteo && meteo.historique.length > 0) {
      const et0Moy = meteo.et0_7j / Math.max(meteo.historique.length, 1)
      const { litres } = calculerConsommationEauAvecMeteo(
        surface, besoinEau, retentionEauSol,
        { et0Journalier: et0Moy, precipitations7j: sousAbri ? 0 : meteo.pluie7jPassees }
      )
      consommationSemaine = litres
    } else {
      consommationSemaine = calculerConsommationEauAvecSol(surface, besoinEau, retentionEauSol)
    }

    // Urgence avec météo
    const { urgence, raison } = calculerUrgenceMeteo(
      joursSansEau, besoinEau, retentionEauSol, meteo, sousAbri
    )

    // Alerte sécheresse (sol faible rétention + pas pluie + culture exigeante)
    const joursSansPluieEffectifs = meteo ? (sousAbri ? 999 : meteo.joursSansPluie) : 0
    const alerteSecheresseActive = alerteSecheresse(
      joursSansEau, retentionEauSol, besoinEau, joursSansPluieEffectifs
    )

    // Résumé météo pour le frontend
    const meteoResume = meteo ? {
      pluie48h: sousAbri ? 0 : Math.round(meteo.pluie48hPassees * 10) / 10,
      pluie7j: sousAbri ? 0 : Math.round(meteo.pluie7jPassees * 10) / 10,
      pluiePrevue48h: sousAbri ? 0 : Math.round(meteo.pluiePrevue48h * 10) / 10,
      pluiePrevue5j: sousAbri ? 0 : Math.round(meteo.pluiePrevue5j * 10) / 10,
      joursSansPluie: sousAbri ? null : meteo.joursSansPluie,
      joursAvantPluie: sousAbri ? null : (meteo.joursAvantPluie < 99 ? meteo.joursAvantPluie : null),
    } : null

    return {
      ...c,
      joursSansEau,
      ageJours,
      isJeune,
      urgence,
      raisonUrgence: raison,
      sousAbri,
      alerteSecheresse: alerteSecheresseActive,
      consommationEauSemaine: Math.round(consommationSemaine * 10) / 10,
      meteo: meteoResume,
    }
  })

  // 6. Trier par urgence
  const urgenceOrder: Record<string, number> = { critique: 0, haute: 1, moyenne: 2, faible: 3, aucune: 4 }
  culturesAvecUrgence.sort((a, b) => {
    return (urgenceOrder[a.urgence] ?? 4) - (urgenceOrder[b.urgence] ?? 4)
  })

  // 7. Grouper par îlot
  const parIlot: Record<string, typeof culturesAvecUrgence> = {}
  for (const culture of culturesAvecUrgence) {
    const ilot = culture.planche?.ilot || 'Sans îlot'
    if (!parIlot[ilot]) parIlot[ilot] = []
    parIlot[ilot].push(culture)
  }

  // Grouper par type irrigation
  const parTypeIrrigation: Record<string, typeof culturesAvecUrgence> = {}
  for (const culture of culturesAvecUrgence) {
    const type = culture.planche?.irrigation || 'Non défini'
    if (!parTypeIrrigation[type]) parTypeIrrigation[type] = []
    parTypeIrrigation[type].push(culture)
  }

  // 8. Stats
  // Une planche multiculture est arrosée en un seul passage. Additionner
  // les estimations de chaque culture ferait compter plusieurs fois la
  // même surface ; le besoin le plus exigeant pilote donc la planche.
  // La règle est partagée avec l'écran (QA cmsqlstoi) : voir
  // `src/lib/irrigation/consommation.ts`.
  const stats = {
    total: cultures.length,
    nbIlots: Object.keys(parIlot).length,
    critique: culturesAvecUrgence.filter(c => c.urgence === 'critique').length,
    haute: culturesAvecUrgence.filter(c => c.urgence === 'haute').length,
    aucune: culturesAvecUrgence.filter(c => c.urgence === 'aucune').length,
    jamaisArrose: culturesAvecUrgence.filter(c => c.joursSansEau === null).length,
    consommationTotaleEstimee: consommationHebdoTotale(culturesAvecUrgence),
    parTypeIrrigation: Object.entries(parTypeIrrigation).map(([type, cultures]) => ({
      type,
      count: cultures.length,
    })),
  }

  // 9. Résumé météo global (première zone trouvée)
  const premiereZone = meteoParCoord.size > 0 ? meteoParCoord.values().next().value : null
  const meteoGlobal = premiereZone ? {
    pluie48h: Math.round((premiereZone as MeteoParCoord).pluie48hPassees * 10) / 10,
    pluie7j: Math.round((premiereZone as MeteoParCoord).pluie7jPassees * 10) / 10,
    pluiePrevue48h: Math.round((premiereZone as MeteoParCoord).pluiePrevue48h * 10) / 10,
    pluiePrevue5j: Math.round((premiereZone as MeteoParCoord).pluiePrevue5j * 10) / 10,
    joursSansPluie: (premiereZone as MeteoParCoord).joursSansPluie,
    joursAvantPluie: (premiereZone as MeteoParCoord).joursAvantPluie < 99 ? (premiereZone as MeteoParCoord).joursAvantPluie : null,
  } : null

  return {
    data: culturesAvecUrgence,
    parIlot,
    parTypeIrrigation,
    stats,
    annee,
    meteo: meteoGlobal,
  }
}
