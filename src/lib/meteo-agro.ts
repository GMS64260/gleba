/**
 * Calculs agronomiques basés sur les données météo
 * Bilan hydrique, degrés-jours, recommandations irrigation,
 * ensoleillement, alertes météo
 */

import type { MeteoJournaliere, MeteoPrevision } from './meteo'

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

// Kc par categorie d'espece et stade phénologique
const KC_VALUES: Record<string, { initial: number; midSeason: number; late: number }> = {
  // Légumes-fruits
  'Tomate': { initial: 0.6, midSeason: 1.15, late: 0.8 },
  'Courgette': { initial: 0.5, midSeason: 1.0, late: 0.8 },
  'Concombre': { initial: 0.6, midSeason: 1.0, late: 0.75 },
  'Poivron': { initial: 0.6, midSeason: 1.05, late: 0.9 },
  'Aubergine': { initial: 0.6, midSeason: 1.05, late: 0.9 },
  'Melon': { initial: 0.5, midSeason: 1.05, late: 0.75 },
  // Légumes-feuilles
  'Salade': { initial: 0.7, midSeason: 1.0, late: 0.95 },
  'Épinard': { initial: 0.7, midSeason: 1.0, late: 0.95 },
  'Chou': { initial: 0.7, midSeason: 1.05, late: 0.95 },
  // Légumes-racines
  'Carotte': { initial: 0.7, midSeason: 1.05, late: 0.95 },
  'Oignon': { initial: 0.7, midSeason: 1.05, late: 0.75 },
  'Pomme de terre': { initial: 0.5, midSeason: 1.15, late: 0.75 },
  'Betterave': { initial: 0.5, midSeason: 1.05, late: 0.95 },
  // Légumineuses
  'Haricot': { initial: 0.4, midSeason: 1.15, late: 0.35 },
  'Pois': { initial: 0.5, midSeason: 1.15, late: 0.3 },
  // Défaut
  'default': { initial: 0.6, midSeason: 1.0, late: 0.8 },
}

/**
 * Estime le coefficient cultural Kc en fonction de l'espece et du stade
 * stadeRatio: 0 = semis, 0.5 = pleine croissance, 1.0 = fin de cycle
 */
export function getKc(espece: string, stadeRatio: number): number {
  // Normaliser la casse : "tomate" → "Tomate" pour correspondre aux clés KC_VALUES
  const especeNormalized = espece.charAt(0).toUpperCase() + espece.slice(1).toLowerCase()
  const kc = KC_VALUES[especeNormalized] || KC_VALUES[espece] || KC_VALUES['default']

  if (stadeRatio < 0.25) return kc.initial
  if (stadeRatio < 0.75) {
    // Interpolation linéaire initial → midSeason
    const t = (stadeRatio - 0.25) / 0.5
    return kc.initial + t * (kc.midSeason - kc.initial)
  }
  // Interpolation midSeason → late
  const t = (stadeRatio - 0.75) / 0.25
  return kc.midSeason + t * (kc.late - kc.midSeason)
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
 * Génère des recommandations d'irrigation intelligentes
 * Combine : données météo réelles + prévisions + sol + besoins culture
 */
export function genererRecommandationIrrigation(
  historique7j: MeteoJournaliere[],
  previsions: MeteoPrevision[],
  culture: {
    id: number
    espece: string
    besoinEau: number // 1-5
    dateSemis: Date | null
    derniereIrrigation: Date | null
  },
  planche: {
    nom: string
    surface: number // m²
    retentionEau: string | null
    typeSol: string | null
  }
): RecommandationIrrigation {
  // Précipitations cumulées 7 derniers jours
  const precip7j = historique7j.reduce((sum, d) => sum + d.precipitation, 0)

  // ET0 cumulée 7 derniers jours
  const et0_7j = historique7j.reduce((sum, d) => sum + d.et0, 0)

  // Coefficient cultural estimé
  const stadeRatio = culture.dateSemis
    ? Math.min(1, (Date.now() - culture.dateSemis.getTime()) / (120 * 86400000)) // ~120j cycle moyen
    : 0.5

  const kc = getKc(culture.espece, stadeRatio)
  const etc7j = et0_7j * kc

  // Inclure la pluie du jour (forecast[0]) dans l'historique
  // L'archive Open-Meteo s'arrête à hier, le forecast commence aujourd'hui
  const pluieAujourdhui = previsions.length > 0 ? previsions[0].precipitation : 0
  const precip7jTotal = precip7j + pluieAujourdhui

  // Bilan hydrique 7j (avec pluie du jour)
  const bilanHydrique7j = Math.round((precip7jTotal - etc7j) * 10) / 10

  // Pluie prevue demain + après-demain (aujourd'hui est dans l'historique)
  const pluiePrevue48h = previsions.slice(1, 3).reduce((sum, d) => sum + d.precipitation, 0)

  // Pluie prevue 5 prochains jours (hors aujourd'hui)
  const pluiePrevue5j = previsions.slice(1, 6).reduce((sum, d) => sum + d.precipitation, 0)

  // Prochaine pluie significative (> 5mm)
  const prochainePluie = previsions.slice(1).find(d => d.precipitation >= 5)?.date || null

  // Jours sans pluie significative
  let joursSansPluie = 0
  if (pluieAujourdhui >= 1) {
    joursSansPluie = 0
  } else {
    joursSansPluie = 1
    for (let i = historique7j.length - 1; i >= 0; i--) {
      if (historique7j[i].precipitation < 1) joursSansPluie++
      else break
    }
  }

  // Pluie cumulée des 48h passées (hier + avant-hier + aujourd'hui)
  const pluie48hPassees = historique7j.slice(-2).reduce((s, d) => s + d.precipitation, 0) + pluieAujourdhui

  // Facteur sol
  const facteurSol = planche.retentionEau === 'Faible' ? 1.3
    : planche.retentionEau === 'Élevée' ? 0.7
    : 1.0

  // Calcul de l'urgence — aligné avec /api/cultures/irriguer
  let urgence: RecommandationIrrigation['urgence']
  const deficit = Math.abs(Math.min(0, bilanHydrique7j)) * facteurSol
  const besoinNormalise = culture.besoinEau / 5 // 0-1

  // Bilan prospectif : si on ajoute la pluie prévue 5j, est-ce que le déficit se comble ?
  const bilanProspectif = bilanHydrique7j + pluiePrevue5j

  // Cas favorable : pluie récente abondante (>8mm en 48h)
  if (pluie48hPassees >= 8 && (pluiePrevue5j >= 5 || bilanHydrique7j > 5)) {
    urgence = 'aucune'
  } else if (bilanHydrique7j > 5 && pluiePrevue48h > 3) {
    urgence = 'aucune'
  } else if (pluiePrevue5j >= 15 && bilanProspectif > 0) {
    // Pluie abondante prevue dans les 5j qui comblera le déficit
    urgence = 'aucune'
  } else if (pluiePrevue5j >= 10) {
    // Pluie significative prevue dans les 5j — pas d'urgence critique
    urgence = bilanProspectif > -5 ? 'faible' : 'moyenne'
  } else if (pluiePrevue48h >= 10 && bilanHydrique7j > -10) {
    urgence = 'faible'
  } else if (deficit > 20 * besoinNormalise && joursSansPluie >= 5 && pluiePrevue48h < 5 && pluiePrevue5j < 8) {
    urgence = 'critique'
  } else if (deficit > 10 * besoinNormalise && joursSansPluie >= 3 && pluiePrevue48h < 8 && pluiePrevue5j < 10) {
    urgence = 'haute'
  } else if (deficit > 5 && joursSansPluie > 2) {
    urgence = 'moyenne'
  } else if (bilanHydrique7j < 0) {
    urgence = 'faible'
  } else {
    urgence = 'aucune'
  }

  // Quantité recommandée (L/m²)
  const conseilQuantite = urgence === 'aucune' ? 0
    : Math.round(Math.max(deficit, etc7j / 7 * 2) * facteurSol * 10) / 10

  // Message de conseil
  const conseilMessage = genererConseilMessage(
    urgence, bilanHydrique7j, pluiePrevue48h, pluiePrevue5j, prochainePluie,
    conseilQuantite, joursSansPluie, planche.retentionEau
  )

  return {
    cultureId: culture.id,
    cultureName: culture.espece,
    plancheName: planche.nom,
    urgence,
    bilanHydrique7j,
    pluiePrevue48h: Math.round(pluiePrevue48h * 10) / 10,
    conseilQuantite,
    conseilMessage,
    prochainePluie,
    joursSansPluie,
  }
}

function genererConseilMessage(
  urgence: string,
  bilan7j: number,
  pluie48h: number,
  pluie5j: number,
  prochainePluie: string | null,
  quantite: number,
  joursSansPluie: number,
  retentionEau: string | null
): string {
  if (urgence === 'aucune') {
    if (pluie48h > 5) {
      return `Pas besoin d'arroser. ${Math.round(pluie48h)}mm de pluie prévus dans les 48h.`
    }
    if (pluie5j >= 10) {
      return `Pas besoin d'arroser. ${Math.round(pluie5j)}mm de pluie prévus dans les 5 prochains jours.`
    }
    return 'Bilan hydrique positif, pas besoin d\'irrigation.'
  }

  const parts: string[] = []

  if (urgence === 'critique') {
    parts.push(`Irrigation urgente recommandée : ${quantite} L/m².`)
  } else if (urgence === 'haute') {
    parts.push(`Irrigation recommandée : ${quantite} L/m².`)
  } else if (urgence === 'moyenne') {
    parts.push(`Irrigation à prévoir : ${quantite} L/m².`)
  } else {
    parts.push(`Irrigation légère conseillée : ${quantite} L/m².`)
  }

  if (joursSansPluie >= 5) {
    parts.push(`${joursSansPluie} jours sans pluie.`)
  }

  if (bilan7j < -10) {
    parts.push(`Déficit hydrique de ${Math.abs(bilan7j)}mm sur 7 jours.`)
  }

  if (pluie5j >= 10) {
    parts.push(`${Math.round(pluie5j)}mm de pluie prévus dans les 5 prochains jours.`)
  }

  if (prochainePluie) {
    parts.push(`Pluie prevue le ${new Date(prochainePluie).toLocaleDateString('fr-FR')}.`)
  } else if (pluie48h >= 3) {
    parts.push(`${Math.round(pluie48h)}mm de pluie prévus dans les 48h — possibilité d'attendre.`)
  }

  if (retentionEau === 'Faible') {
    parts.push('Sol sableux : privilégier des arrosages fréquents et légers.')
  } else if (retentionEau === 'Élevée') {
    parts.push('Sol argileux : espacer les arrosages, bien mouiller en profondeur.')
  }

  return parts.join(' ')
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
        details: 'Vent supérieur à 19 km/h : les traitements phytosanitaires sont interdits (arrêté du 12/09/2006). Reporter les pulvérisations.',
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
