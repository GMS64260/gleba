/**
 * Calculs agronomiques basés sur les données météo
 * Bilan hydrique, degrés-jours, recommandations irrigation,
 * ensoleillement, alertes météo
 */

import type { MeteoJournaliere, MeteoPrevision } from './meteo'
import { kcAuStade, phraseVolume, profilEspece, volumeArrosage } from './irrigation/bilan-sol'
import { bilanCulture, joursDepuisArrosage, type CultureBilan } from './irrigation/bilan-culture'
import type { ArrosageSaisi } from './irrigation/arrosages-saisis'
import { joursSansPluieRecue, pluieSeptDerniersJours, type MeteoBilan } from './irrigation/meteo-bilan'

// ============================================================
// TYPES
// ============================================================

export interface BilanHydrique {
  date: string
  precipitation: number // mm
  et0: number // mm (évapotranspiration de reference)
  etc: number // mm (ETc = ET0 × Kc, ajustée culture)
  bilan: number // mm (P - ETc)
  bilanCumule: number // mm
  reserveUtile: number // mm (estimation eau disponible dans le sol)
}

export interface DegreJours {
  date: string
  tempMin: number
  tempMax: number
  gdd: number // Growing Degree Days du jour
  gddCumule: number // GDD cumulés depuis date de départ
}

export interface RecommandationIrrigation {
  cultureId: number
  cultureName: string
  plancheName: string
  urgence: 'critique' | 'haute' | 'moyenne' | 'faible' | 'aucune'
  bilanHydrique7j: number // mm (négatif = déficit)
  pluiePrevue48h: number // mm
  conseilQuantite: number // L/m²
  conseilMessage: string
  prochainePluie: string | null // date ISO si pluie prévue
  joursSansPluie: number
  joursDepuisIrrigation: number | null
}

export interface AlerteMeteo {
  type: 'gel' | 'canicule' | 'secheresse' | 'vent_traitement' | 'grele'
  niveau: 'info' | 'attention' | 'danger'
  date: string
  message: string
  details: string
}

export interface EnsoleillementResume {
  totalHeures: number
  moyenneJour: number
  radiationTotaleMJ: number // MJ/m²
  joursSoleil: number // jours > 6h
  joursGris: number // jours < 2h
}

// ============================================================
// COEFFICIENTS CULTURAUX (Kc) - FAO 56
// ============================================================

/**
 * Coefficient cultural au stade (0 = semis, 0,5 = pleine croissance, 1 = fin
 * de cycle). Une seule table d'espèces depuis le 2026-10-10 : celle du moteur
 * de bilan hydrique (`src/lib/irrigation/bilan-sol.ts`, FAO-56 tableau 12).
 */
export function getKc(espece: string, stadeRatio: number): number {
  return kcAuStade(profilEspece(espece, 3), stadeRatio)
}

// ============================================================
// BILAN HYDRIQUE
// ============================================================

/**
 * Calcule le bilan hydrique journalier
 * Bilan = Précipitations - ETc (ETc = ET0 × Kc)
 *
 * @param meteoData Données météo journalières
 * @param kc Coefficient cultural
 * @param reserveUtileMax Réserve utile max du sol en mm (dépend de la texture)
 * @param reserveInitiale Réserve au départ (mm), défaut = 50% de la max
 */
export function calculerBilanHydrique(
  meteoData: MeteoJournaliere[],
  kc: number = 1.0,
  reserveUtileMax: number = 60,
  reserveInitiale?: number
): BilanHydrique[] {
  let bilanCumule = 0
  let reserve = reserveInitiale ?? reserveUtileMax * 0.5

  return meteoData.map(day => {
    const etc = day.et0 * kc
    const bilan = day.precipitation - etc
    bilanCumule += bilan
    reserve = Math.max(0, Math.min(reserveUtileMax, reserve + bilan))

    return {
      date: day.date,
      precipitation: day.precipitation,
      et0: day.et0,
      etc: Math.round(etc * 10) / 10,
      bilan: Math.round(bilan * 10) / 10,
      bilanCumule: Math.round(bilanCumule * 10) / 10,
      reserveUtile: Math.round(reserve * 10) / 10,
    }
  })
}

// ============================================================
// DEGRÉS-JOURS (GDD)
// ============================================================

/**
 * Calcule les degrés-jours (Growing Degree Days)
 * GDD = max(0, (Tmax + Tmin) / 2 - Tbase)
 *
 * @param meteoData Données météo
 * @param tempBase Température de base (°C), défaut 10°C pour la plupart des légumes
 */
export function calculerDegreJours(
  meteoData: MeteoJournaliere[],
  tempBase: number = 10
): DegreJours[] {
  let gddCumule = 0

  return meteoData.map(day => {
    const gdd = Math.max(0, (day.tempMax + day.tempMin) / 2 - tempBase)
    gddCumule += gdd

    return {
      date: day.date,
      tempMin: day.tempMin,
      tempMax: day.tempMax,
      gdd: Math.round(gdd * 10) / 10,
      gddCumule: Math.round(gddCumule * 10) / 10,
    }
  })
}

// ============================================================
// RECOMMANDATIONS D'IRRIGATION
// ============================================================

/**
 * Recommandation d'irrigation d'une culture pour le conseiller du Calendrier
 * potager et de /meteo.
 *
 * Itération du 2026-10-10 : plus de calcul propre. Le bilan hydrique de la
 * réserve du sol (`src/lib/irrigation/bilan-sol.ts`) est le moteur unique,
 * partagé avec les lignes « à arroser » des tâches : même culture, même jour,
 * même urgence. Cette fonction ne fait que le traduire pour l'écran.
 */
export function genererRecommandationIrrigation(
  meteo: MeteoBilan,
  culture: CultureBilan & {
    id: number
    /** Arrosages saisis sur la fenêtre du bilan (« Noter » et interventions). */
    arrosages: ArrosageSaisi[]
  },
  planche: {
    nom: string
    surface: number // m²
    retentionEau: string | null
    typeSol: string | null
    /** Sol de la parcelle, quand la planche n'en a pas. */
    typeSolParcelle?: string | null
    /** Système d'arrosage de la planche (efficacité de l'apport). */
    irrigation?: string | null
  },
  /** null : type de planche non renseigné (`typeSousAbri`), le conseil le dit. */
  sousAbri: boolean | null = false,
): RecommandationIrrigation {
  const res = bilanCulture(meteo, culture, planche, { sousAbri, arrosages: culture.arrosages })

  // Bilan des 7 derniers jours (pluie utile à l'écran, sans pluie sous abri).
  // Les 7 derniers jours, aujourd'hui exclu : la définition de /meteo.
  const pluie7j = sousAbri ? 0 : pluieSeptDerniersJours(meteo)
  const bilanHydrique7j = Math.round((pluie7j - res.etcPotentielleMoyenne7j * 7) * 10) / 10

  // Jours sans pluie significative reçue : la pluie annoncée pour aujourd'hui
  // ne compte pas comme tombée (revue du 2026-10-28, même règle que le bilan).
  const joursSansPluie = sousAbri ? 0 : joursSansPluieRecue(meteo)
  const prochainePluie = sousAbri ? null : meteo.previsions.find((j) => j.pluie >= 5)?.date ?? null

  // Dose : remplir la réserve, à l'efficacité du système près.
  const volume = volumeArrosage(res.doseMm, planche.surface, planche.irrigation)
  const conseilQuantite = volume.litresParM2
  // Sol de la planche inconnu : la dose n'est qu'un ordre de grandeur (QA cmv3jaru7).
  const conseilMessage = conseilQuantite > 0
    ? `${res.raison} ${phraseVolume(volume, 'pour la planche', res.solSource !== 'planche')}`
    : res.raison

  return {
    cultureId: culture.id,
    cultureName: culture.espece,
    plancheName: planche.nom,
    urgence: res.urgence,
    bilanHydrique7j,
    pluiePrevue48h: res.pluiePrevue48h,
    conseilQuantite,
    conseilMessage,
    prochainePluie,
    joursSansPluie,
    joursDepuisIrrigation: joursDepuisArrosage(meteo, culture.derniereIrrigation, culture.arrosages),
  }
}


// ============================================================
// ALERTES MÉTÉO
// ============================================================

/**
 * Génère les alertes météo pertinentes pour l'agriculture
 */
export function genererAlertesMeteo(
  previsions: MeteoPrevision[],
  historique: MeteoJournaliere[] = []
): AlerteMeteo[] {
  const alertes: AlerteMeteo[] = []

  for (const jour of previsions) {
    // Alerte gel
    if (jour.tempMin <= 0) {
      alertes.push({
        type: 'gel',
        niveau: jour.tempMin <= -3 ? 'danger' : 'attention',
        date: jour.date,
        message: `Risque de gel : ${jour.tempMin}°C prévu`,
        details: jour.tempMin <= -3
          ? 'Gel sévère. Protéger les cultures sensibles (voiles, paillage, serres). Risque pour les arbres fruitiers en floraison.'
          : 'Gel léger possible. Surveiller les cultures non protégées et les semis récents.',
      })
    }

    // Alerte canicule
    if (jour.tempMax >= 35) {
      alertes.push({
        type: 'canicule',
        niveau: jour.tempMax >= 40 ? 'danger' : 'attention',
        date: jour.date,
        message: `Canicule : ${jour.tempMax}°C prévu`,
        details: 'Augmenter la fréquence d\'irrigation. Ombrer les cultures sensibles (salades, épinards). Arroser tôt le matin ou le soir.',
      })
    }

    // Alerte grêle (orages forts)
    // On ne peut pas prédire la grêle directement, mais les orages violents sont un indicateur

    // Fenêtre de traitement phyto (vent)
    if (jour.windSpeedMax >= 19) {
      alertes.push({
        type: 'vent_traitement',
        niveau: 'info',
        date: jour.date,
        message: `Vent fort : ${Math.round(jour.windSpeedMax)} km/h — traitements déconseillés`,
        details: 'Vent supérieur à 19 km/h (force 3 Beaufort) : les traitements phytosanitaires sont interdits (arrêté du 4 mai 2017 modifié). Reporter les pulvérisations.',
      })
    }
  }

  // Alerte sécheresse (basée sur l'historique)
  if (historique.length >= 7) {
    const precip7j = historique.slice(-7).reduce((sum, d) => sum + d.precipitation, 0)
    const et0_7j = historique.slice(-7).reduce((sum, d) => sum + d.et0, 0)
    const pluiePrevue3j = previsions.slice(0, 3).reduce((sum, d) => sum + d.precipitation, 0)

    if (precip7j < 5 && et0_7j > 30 && pluiePrevue3j < 5) {
      alertes.push({
        type: 'secheresse',
        niveau: precip7j < 2 ? 'danger' : 'attention',
        date: new Date().toISOString().split('T')[0],
        message: `Sécheresse : ${Math.round(precip7j)}mm en 7j, ET0 de ${Math.round(et0_7j)}mm`,
        details: `Seulement ${Math.round(precip7j)}mm de pluie en 7 jours pour ${Math.round(et0_7j)}mm d'évapotranspiration. Pas de pluie significative prévue dans les 3 prochains jours. Prioriser l'irrigation des cultures exigeantes en eau.`,
      })
    }
  }

  return alertes
}

// ============================================================
// ENSOLEILLEMENT
// ============================================================

/**
 * Calcule le résumé d'ensoleillement sur une période
 */
export function calculerEnsoleillement(meteoData: MeteoJournaliere[]): EnsoleillementResume {
  if (meteoData.length === 0) {
    return { totalHeures: 0, moyenneJour: 0, radiationTotaleMJ: 0, joursSoleil: 0, joursGris: 0 }
  }

  const totalHeures = meteoData.reduce((sum, d) => sum + d.sunshine, 0)
  const radiationTotaleMJ = meteoData.reduce((sum, d) => sum + d.radiation, 0)
  const joursSoleil = meteoData.filter(d => d.sunshine >= 6).length
  const joursGris = meteoData.filter(d => d.sunshine < 2).length

  return {
    totalHeures: Math.round(totalHeures * 10) / 10,
    moyenneJour: Math.round((totalHeures / meteoData.length) * 10) / 10,
    radiationTotaleMJ: Math.round(radiationTotaleMJ * 10) / 10,
    joursSoleil,
    joursGris,
  }
}
