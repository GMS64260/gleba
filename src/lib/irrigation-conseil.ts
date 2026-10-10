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
import { volumeArrosage, type ResultatBilanSol } from '@/lib/irrigation/bilan-sol'
import { bilanCulture } from '@/lib/irrigation/bilan-culture'
import { chargerMeteoBilan, debutArrosagesBilan, type MeteoBilan } from '@/lib/irrigation/meteo-bilan'
import { whereArrosageNote } from '@/lib/irrigation/arrosages-notes'
import {
  getIrrigationFactors,
  calculerConsommationEauAvecSol,
  alerteSecheresse,
} from '@/lib/soil-quality'
import { cultureIrrigationDemarreeWhere } from '@/lib/irrigation-eligibility'
import { surfaceCultureM2 } from '@/lib/culture-surface'
import { consommationHebdoTotale } from '@/lib/irrigation/consommation'

// ── Types internes ──────────────────────────────────────────

interface MeteoParCoord {
  lat: number
  lng: number
  /** Série du bilan hydrique (30 j passés, aujourd'hui, 7 j prévus). */
  bilan: MeteoBilan
  pluie48hPassees: number  // mm cumulés hier + avant-hier + aujourd'hui
  pluie7jPassees: number   // mm cumulés 7 derniers jours + aujourd'hui
  et0_7j: number           // mm ET0 cumulés 7 j + aujourd'hui
  joursSansPluie: number   // jours consécutifs sans pluie significative
  pluiePrevue48h: number   // mm prévus demain et après-demain
  pluiePrevue5j: number    // mm prévus dans les 5 prochains jours
  joursAvantPluie: number  // jours avant la prochaine pluie significative (99 = aucune)
}

const TYPES_SOUS_ABRI = ['Serre', 'Tunnel', 'Châssis', 'Chassis']

// Seuils partagés avec le conseiller du Calendrier (meteo-agro.ts) et le moteur.
import {
  JOURS_APRES_DEBUT_RECOLTE_SANS_FIN,
  JOURS_APRES_FIN_RECOLTE,
  SEUIL_PLUIE_SIGNIFICATIVE,
} from '@/lib/irrigation/seuils'
export { JOURS_APRES_FIN_RECOLTE, SEUIL_PLUIE_SIGNIFICATIVE }

type Urgence = 'critique' | 'haute' | 'moyenne' | 'faible' | 'aucune'

/**
 * Résumé météo d'une zone pour l'écran (pluies passées et prévues), tiré de
 * la même série que le bilan hydrique.
 */
export function resumeMeteo(bilan: MeteoBilan): Omit<MeteoParCoord, 'lat' | 'lng' | 'bilan'> {
  const derniers7 = bilan.historique.slice(-7)
  const pluieAujourdhui = bilan.aujourdhui.pluie
  let joursSansPluie = 0
  if (pluieAujourdhui < SEUIL_PLUIE_SIGNIFICATIVE) {
    joursSansPluie = 1
    for (let i = bilan.historique.length - 1; i >= 0; i--) {
      if (bilan.historique[i].pluie < SEUIL_PLUIE_SIGNIFICATIVE) joursSansPluie++
      else break
    }
  }
  const idx = bilan.previsions.findIndex((j) => j.pluie >= SEUIL_PLUIE_SIGNIFICATIVE)
  return {
    pluie48hPassees: bilan.historique.slice(-2).reduce((s, j) => s + j.pluie, 0) + pluieAujourdhui,
    pluie7jPassees: derniers7.reduce((s, j) => s + j.pluie, 0) + pluieAujourdhui,
    et0_7j: derniers7.reduce((s, j) => s + j.et0, 0) + bilan.aujourdhui.et0,
    joursSansPluie,
    pluiePrevue48h: bilan.previsions.slice(0, 2).reduce((s, j) => s + j.pluie, 0),
    pluiePrevue5j: bilan.previsions.slice(0, 5).reduce((s, j) => s + j.pluie, 0),
    joursAvantPluie: idx >= 0 ? idx + 1 : 99,
  }
}

/**
 * Sans météo, pas de bilan : on ne sait pas s'il a plu. L'ancien compteur de
 * jours rendait « critique » tous les 3 à 4 jours, été comme hiver ; le
 * conseil plafonne donc à « moyenne » (à surveiller, jamais une tâche) et dit
 * pourquoi : parcelle à géolocaliser, ou service météo momentanément muet.
 */
export function urgenceFallback(
  joursSansEau: number | null,
  besoinEau: number,
  retentionEau: string | null,
  cause: 'sans-coordonnees' | 'meteo-indisponible' = 'sans-coordonnees',
): { urgence: Urgence; raison: string } {
  const conseil = cause === 'meteo-indisponible'
    ? 'Météo momentanément indisponible, conseil à revoir plus tard.'
    : 'Géolocalisez une parcelle pour un conseil météo.'
  if (joursSansEau === null) {
    return { urgence: 'moyenne', raison: `Jamais arrosé. ${conseil}` }
  }
  const factors = getIrrigationFactors(retentionEau || 'Moyenne')
  const seuil = besoinEau >= 4 ? 2 : 3
  if (joursSansEau * factors.urgenceFactor >= seuil) {
    return { urgence: 'moyenne', raison: `${joursSansEau}j sans arrosage. ${conseil}` }
  }
  return { urgence: 'faible', raison: 'Arrosé récemment.' }
}

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
      dateRecolte: true,
      finRecolte: true,
      nbRangs: true,
      longueur: true,
      espece: {
        select: {
          id: true,
          nom: true,
          couleur: true,
          besoinEau: true,
          irrigation: true,
          vivace: true,
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
  const coordsParZone = new Map<string, { lat: number; lng: number }>()
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

    if (!coordsParZone.has(key)) coordsParZone.set(key, { lat, lng })
  }

  // 3. Météo du bilan hydrique pour chaque zone (en parallèle). Une zone en
  //    échec reste absente : ses cultures passent par le repli « météo
  //    indisponible », jamais par des zéros qui diraient « tout va bien ».
  const zonesEnEchec = new Set<string>()
  await Promise.all(
    Array.from(coordsParZone.entries()).map(async ([key, { lat, lng }]) => {
      try {
        const bilan = await chargerMeteoBilan(lat, lng)
        if (!bilan) {
          zonesEnEchec.add(key)
          return
        }
        meteoParCoord.set(key, { lat, lng, bilan, ...resumeMeteo(bilan) })
      } catch (err) {
        console.error(`Erreur météo pour zone ${key}:`, err)
        zonesEnEchec.add(key)
      }
    })
  )

  // 4. Arrosages notés depuis le début de l'historique du bilan, par culture
  //    (traces de `enregistrerArrosageCultures`), plus le dernier arrosage connu.
  const debutFenetre = debutArrosagesBilan()
  const traces = cultures.length
    ? await prisma.irrigationPlanifiee.findMany({
        where: {
          userId,
          cultureId: { in: cultures.map((c) => c.id) },
          AND: [whereArrosageNote(), { dateEffective: { gte: debutFenetre } }],
        },
        select: { cultureId: true, dateEffective: true },
      })
    : []
  const arrosagesParCulture = new Map<number, Date[]>()
  for (const t of traces) {
    if (!t.dateEffective) continue
    arrosagesParCulture.set(t.cultureId, [...(arrosagesParCulture.get(t.cultureId) ?? []), t.dateEffective])
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
    const surface = surfaceCultureM2(c)

    const besoinEau = c.espece?.besoinEau || 3
    const retentionEauSol = c.planche?.retentionEau || null
    const sousAbri = TYPES_SOUS_ABRI.includes(c.planche?.type ?? '')

    // Météo pour cette culture
    const coordKey = cultureCoordKey.get(c.id)
    const meteo = coordKey ? meteoParCoord.get(coordKey) ?? null : null

    // Bilan hydrique de la réserve du sol (moteur unique, bilan-sol.ts).
    const bilan: ResultatBilanSol | null = meteo
      ? bilanCulture(
          meteo.bilan,
          {
            espece: c.espece?.nom ?? c.especeId,
            besoinEau,
            vivace: c.espece?.vivace ?? false,
            dateSemis: c.dateSemis,
            datePlantation: c.datePlantation,
            semisFait: c.semisFait,
            plantationFaite: c.plantationFaite,
            dateRecolte: c.dateRecolte,
            finRecolte: c.finRecolte,
            derniereIrrigation: c.derniereIrrigation,
          },
          { typeSol: c.planche?.typeSol ?? null, retentionEau: retentionEauSol },
          { sousAbri, arrosages: arrosagesParCulture.get(c.id) ?? [] },
        )
      : null
    const coordKeyCulture = cultureCoordKey.get(c.id)
    const { urgence, raison } = bilan
      ? { urgence: bilan.urgence, raison: bilan.raison }
      : urgenceFallback(
          joursSansEau, besoinEau, retentionEauSol,
          coordKeyCulture && zonesEnEchec.has(coordKeyCulture) ? 'meteo-indisponible' : 'sans-coordonnees',
        )

    // Besoin de la semaine : ETc potentielle moyenne des 7 derniers jours ×
    // surface (mm × m² = L). Pas la consommation réelle, que le manque d'eau
    // réduit : une planche assoiffée afficherait un besoin plus faible.
    const consommationSemaine = bilan
      ? bilan.etcPotentielleMoyenne7j * 7 * surface
      : calculerConsommationEauAvecSol(surface, besoinEau, retentionEauSol)

    // Volume d'un passage : dose au sol / efficacité du système, sur la surface de la culture.
    const volume = bilan ? volumeArrosage(bilan.doseMm, surface, c.planche?.irrigation) : null

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
      /** Réserve du sol (null sans météo). Dose en mm = L/m² ; litres pour la surface. */
      reserve: bilan && volume
        ? {
            depletionMm: bilan.depletionMm,
            reserveFacileMm: bilan.reserveFacileMm,
            reserveUtileMm: bilan.reserveUtileMm,
            tauxEpuisement: bilan.tauxEpuisement,
            joursAvantSeuil: bilan.joursAvantSeuil,
            doseMm: bilan.doseMm,
            litresParM2: volume.litresParM2,
            litresConseilles: volume.litres,
            passages: volume.passages,
            kc: bilan.kc,
            profondeurRacinesM: bilan.profondeurRacinesM,
            dernierApport: bilan.dernierApport,
          }
        : null,
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
