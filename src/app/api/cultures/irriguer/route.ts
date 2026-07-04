/**
 * API Route pour les cultures à irriguer — intégration météo complète
 * GET  /api/cultures/irriguer - Liste avec urgence météo-aware
 * PATCH /api/cultures/irriguer - Marquer arrosage / toggle aIrriguer
 *
 * L'urgence est calculée à partir du bilan hydrique réel :
 *  - Précipitations des 7 derniers jours (Open-Meteo archive)
 *  - Prévisions 7 jours (Open-Meteo forecast)
 *  - Évapotranspiration (ET0) réelle
 *  - Rétention du sol, besoin eau de l'espece
 *
 * Les irrigations planifiées sont auto-validées quand la pluie est suffisante.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi, getUserId } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { irrigationCache, irrigationCacheKey } from '@/lib/irrigation-cache'
import { fetchOpenMeteoForecast, fetchOpenMeteoHistory } from '@/lib/meteo'
import type { MeteoJournaliere, MeteoPrevision } from '@/lib/meteo'
import {
  getIrrigationFactors,
  calculerConsommationEauAvecSol,
  calculerConsommationEauAvecMeteo,
  alerteSecheresse,
} from '@/lib/soil-quality'

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
const SEUIL_PLUIE_AUTO_VALIDE = 8

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

function calculerUrgenceMeteo(
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
  if (pluie48h >= SEUIL_PLUIE_AUTO_VALIDE) {
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
  if (deficit > 20 * besoinNorm && joursEffectifsSansEau >= 5 && pluiePrevue48h < 5 && pluiePrevue5j < 8) {
    return {
      urgence: 'critique',
      raison: `Déficit hydrique de ${Math.round(deficit)}mm. ${joursEffectifsSansEau}j sans eau. Pas de pluie prévue.`,
    }
  }

  if (deficit > 10 * besoinNorm && joursEffectifsSansEau >= 3 && pluiePrevue48h < 8 && pluiePrevue5j < 10) {
    return {
      urgence: 'haute',
      raison: `Déficit de ${Math.round(deficit)}mm, ${joursEffectifsSansEau}j sans eau.${pluiePrevue48h > 0 ? ` ${Math.round(pluiePrevue48h)}mm prévus.` : ''}`,
    }
  }

  if (deficit > 5 && joursEffectifsSansEau > 2) {
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

/** Fallback quand on n'a pas de données météo (pas de coordonnées parcelle) */
function urgenceFallback(
  joursSansEau: number | null,
  besoinEau: number,
  retentionEau: string | null
): { urgence: Urgence; raison: string } {
  if (joursSansEau === null) {
    return { urgence: 'moyenne', raison: 'Jamais arrosé (pas de données météo).' }
  }

  const factors = getIrrigationFactors(retentionEau || 'Moyenne')
  const joursAjustes = joursSansEau * factors.urgenceFactor
  const seuilCritique = besoinEau >= 4 ? 3 : 4
  const seuilHaute = besoinEau >= 4 ? 2 : 3

  if (joursAjustes >= seuilCritique) {
    return { urgence: 'critique', raison: `${joursSansEau}j sans arrosage (pas de données météo).` }
  }
  if (joursAjustes >= seuilHaute) {
    return { urgence: 'haute', raison: `${joursSansEau}j sans arrosage.` }
  }
  if (joursAjustes >= 1) {
    return { urgence: 'moyenne', raison: `${joursSansEau}j sans arrosage.` }
  }
  return { urgence: 'faible', raison: 'Arrosé récemment.' }
}

// ── GET ─────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = getUserId(session)
    const { searchParams } = new URL(request.url)
    const annee = parseInt(searchParams.get('annee') || new Date().getFullYear().toString())

    // 1. Récupérer cultures actives avec planches + coordonnées parcelle
    const cultures = await prisma.culture.findMany({
      where: {
        userId,
        annee,
        terminee: null,
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
        irrigationsPlanifiees: {
          where: {
            fait: false,
            datePrevue: {
              gte: new Date(),
              lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
          },
          select: {
            id: true,
            datePrevue: true,
          },
          orderBy: {
            datePrevue: 'asc',
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
          if (pluieAujourdhui >= 1) {
            joursSansPluie = 0
          } else {
            joursSansPluie = 1 // au moins aujourd'hui
            for (let i = historique.length - 1; i >= 0; i--) {
              if (historique[i].precipitation < 1) joursSansPluie++
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
            if (previsions[i].precipitation >= 3) {
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

    // 4. Auto-valider les irrigations planifiées si la pluie est suffisante
    const irrigationsAutoValidees: number[] = []
    for (const c of cultures) {
      const coordKey = cultureCoordKey.get(c.id)
      const meteo = coordKey ? meteoParCoord.get(coordKey) ?? null : null
      if (!meteo) continue

      const sousAbri = TYPES_SOUS_ABRI.includes(c.planche?.type ?? '')
      if (sousAbri) continue // Sous abri = pluie n'aide pas

      const pluie48h = meteo.pluie48hPassees
      if (pluie48h < SEUIL_PLUIE_AUTO_VALIDE) continue

      // Auto-valider UNIQUEMENT les irrigations DUES (aujourd'hui ou en retard)
      // couvertes par la pluie PASSÉE. Avant, on validait aussi les irrigations
      // FUTURES sur la base des prévisions (joursCouv) : une irrigation de demain
      // passait « faite » dès aujourd'hui, définitivement, via un simple GET
      // (audit 2026-07, #34/#46). Les prévisions peuvent changer : on attend
      // l'échéance réelle.
      for (const irr of c.irrigationsPlanifiees) {
        if (new Date(irr.datePrevue).getTime() <= Date.now()) {
          irrigationsAutoValidees.push(irr.id)
        }
      }
    }

    // Batch auto-validation en DB
    if (irrigationsAutoValidees.length > 0) {
      await prisma.irrigationPlanifiee.updateMany({
        where: {
          id: { in: irrigationsAutoValidees },
          fait: false, // sécurité
        },
        data: {
          fait: true,
          dateEffective: new Date(),
          notes: `Auto-validé : pluie suffisante (${new Date().toLocaleDateString('fr-FR')})`,
        },
      })
    }

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
      const surface = c.nbRangs && c.longueur && c.planche?.largeur
        ? (c.nbRangs * c.longueur * c.planche.largeur)
        : (c.planche?.surface || 0)

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

      // Compter irrigations planifiées restantes (exclure celles auto-validées)
      const irrigationsRestantes = c.irrigationsPlanifiees.filter(
        irr => !irrigationsAutoValidees.includes(irr.id)
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
        prochainesIrrigations: irrigationsRestantes.length,
        irrigationsAutoValidees: c.irrigationsPlanifiees.length - irrigationsRestantes.length,
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
      const ilot = culture.planche?.ilot || 'Sans ilot'
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
    const stats = {
      total: cultures.length,
      nbIlots: Object.keys(parIlot).length,
      critique: culturesAvecUrgence.filter(c => c.urgence === 'critique').length,
      haute: culturesAvecUrgence.filter(c => c.urgence === 'haute').length,
      aucune: culturesAvecUrgence.filter(c => c.urgence === 'aucune').length,
      jamaisArrose: culturesAvecUrgence.filter(c => c.joursSansEau === null).length,
      prochainesIrrigations7j: culturesAvecUrgence.reduce((s, c) => s + c.prochainesIrrigations, 0),
      irrigationsAutoValidees: irrigationsAutoValidees.length,
      consommationTotaleEstimee: Math.round(culturesAvecUrgence.reduce((s, c) => s + c.consommationEauSemaine, 0)),
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

    return NextResponse.json({
      data: culturesAvecUrgence,
      parIlot,
      parTypeIrrigation,
      stats,
      annee,
      meteo: meteoGlobal,
    })
  } catch (error) {
    console.error('GET /api/cultures/irriguer error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des cultures à irriguer', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}

// ── PATCH ───────────────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = getUserId(session)
    const body = await request.json()
    const { cultureId, cultureIds, aIrriguer, marquerArrosage } = body

    // Arrosage multiple (groupe par îlot)
    if (marquerArrosage && cultureIds && Array.isArray(cultureIds)) {
      const now = new Date()
      await prisma.culture.updateMany({
        where: {
          id: { in: cultureIds },
          userId,
        },
        data: { derniereIrrigation: now },
      })
      irrigationCache.invalidateUser(userId)
      return NextResponse.json({ success: true, date: now })
    }

    // Arrosage simple ou toggle aIrriguer
    if (typeof cultureId !== 'number') {
      return NextResponse.json(
        { error: 'ID de culture requis' },
        { status: 400 }
      )
    }

    // Vérifier que la culture appartient à l'utilisateur
    const culture = await prisma.culture.findFirst({
      where: { id: cultureId, userId },
    })

    if (!culture) {
      return NextResponse.json(
        { error: 'Culture non trouvée' },
        { status: 404 }
      )
    }

    // Noter l'arrosage
    if (marquerArrosage) {
      const now = new Date()
      const updated = await prisma.culture.update({
        where: { id: cultureId },
        data: { derniereIrrigation: now },
      })
      irrigationCache.invalidateUser(userId)
      return NextResponse.json({ success: true, data: updated, date: now })
    }

    // Toggle aIrriguer
    const updated = await prisma.culture.update({
      where: { id: cultureId },
      data: { aIrriguer },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('PATCH /api/cultures/irriguer error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
