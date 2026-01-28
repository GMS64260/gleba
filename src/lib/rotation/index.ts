/**
 * Algorithme de calcul des rotations de cultures
 */

import {
  BlockedFamily,
  RecommendedFamily,
  SoilAnalysis,
  SoilStatus,
  EspeceAdvice,
  RotationAdvice,
} from './types'

interface CultureData {
  annee: number
  especeId: string
  espece: {
    id: string
    familleId: string | null
    famille: {
      id: string
      intervalle: number
      couleur: string | null
    } | null
    besoinN: number | null
    besoinP: number | null
    besoinK: number | null
  }
}

interface FamilleData {
  id: string
  intervalle: number
  couleur: string | null
}

interface RotationContext {
  plancheId: string
  targetYear: number
  cultures: CultureData[]
  allFamilies: FamilleData[]
  especeToCheck?: {
    id: string
    familleId: string | null
    besoinN: number | null
  }
}

/**
 * Calcule l'état estimé du sol basé sur les cultures récentes
 */
function calculateSoilStatus(
  cultures: CultureData[],
  targetYear: number
): SoilAnalysis {
  // Cultures des 3 dernières années
  const recentCultures = cultures.filter(
    (c) => c.annee >= targetYear - 3 && c.annee < targetYear
  )

  if (recentCultures.length === 0) {
    return {
      estimatedN: 'normal',
      estimatedP: 'normal',
      estimatedK: 'normal',
      lastHeavyFeeder: null,
      suggestion: 'Pas d\'historique récent - toutes les cultures sont possibles',
    }
  }

  // Calcul des moyennes de besoins
  const avgN =
    recentCultures.reduce((sum, c) => sum + (c.espece.besoinN ?? 3), 0) /
    recentCultures.length
  const avgP =
    recentCultures.reduce((sum, c) => sum + (c.espece.besoinP ?? 3), 0) /
    recentCultures.length
  const avgK =
    recentCultures.reduce((sum, c) => sum + (c.espece.besoinK ?? 3), 0) /
    recentCultures.length

  const getStatus = (avg: number): SoilStatus => {
    if (avg > 4) return 'depleted'
    if (avg < 2) return 'enriched'
    return 'normal'
  }

  const estimatedN = getStatus(avgN)
  const estimatedP = getStatus(avgP)
  const estimatedK = getStatus(avgK)

  // Trouver le dernier gros consommateur d'azote
  const heavyFeeders = recentCultures
    .filter((c) => (c.espece.besoinN ?? 0) >= 4)
    .sort((a, b) => b.annee - a.annee)

  const lastHeavyFeeder = heavyFeeders[0]
    ? { year: heavyFeeders[0].annee, especeId: heavyFeeders[0].especeId }
    : null

  // Suggestion basée sur l'état
  let suggestion = ''
  if (estimatedN === 'depleted') {
    suggestion =
      'Sol appauvri en azote - privilégiez les légumineuses (Fabacées) pour régénérer'
  } else if (estimatedN === 'enriched') {
    suggestion =
      'Sol riche en azote - idéal pour les cultures gourmandes (Solanacées, Cucurbitacées)'
  } else {
    suggestion = 'Sol équilibré - continuez les rotations variées'
  }

  return {
    estimatedN,
    estimatedP,
    estimatedK,
    lastHeavyFeeder,
    suggestion,
  }
}

/**
 * Calcule les familles bloquées par la rotation
 */
function calculateBlockedFamilies(
  cultures: CultureData[],
  allFamilies: FamilleData[],
  targetYear: number
): BlockedFamily[] {
  // Créer une map des dernières années par famille
  const familyLastYears = new Map<string, { year: number; intervalle: number }>()

  for (const culture of cultures) {
    const familleId = culture.espece.familleId
    if (!familleId) continue

    const existing = familyLastYears.get(familleId)
    const intervalle = culture.espece.famille?.intervalle ?? 4

    if (!existing || culture.annee > existing.year) {
      familyLastYears.set(familleId, { year: culture.annee, intervalle })
    }
  }

  // Calculer les familles bloquées
  const blocked: BlockedFamily[] = []

  for (const [familleId, data] of familyLastYears) {
    const yearsRemaining = data.year + data.intervalle - targetYear

    if (yearsRemaining > 0) {
      const famille = allFamilies.find((f) => f.id === familleId)
      blocked.push({
        familleId,
        familleNom: familleId,
        familleCouleur: famille?.couleur ?? null,
        lastYear: data.year,
        intervalle: data.intervalle,
        yearsRemaining,
        reason: `${familleId} planté en ${data.year}, attendre ${data.year + data.intervalle}`,
      })
    }
  }

  return blocked.sort((a, b) => b.yearsRemaining - a.yearsRemaining)
}

/**
 * Calcule les familles recommandées
 */
function calculateRecommendedFamilies(
  cultures: CultureData[],
  allFamilies: FamilleData[],
  blockedFamilies: BlockedFamily[],
  soilStatus: SoilAnalysis,
  targetYear: number
): RecommendedFamily[] {
  const blockedIds = new Set(blockedFamilies.map((b) => b.familleId))
  const recommended: RecommendedFamily[] = []

  // Map des dernières utilisations
  const familyLastUsed = new Map<string, number>()
  for (const culture of cultures) {
    if (culture.espece.familleId) {
      const existing = familyLastUsed.get(culture.espece.familleId)
      if (!existing || culture.annee > existing) {
        familyLastUsed.set(culture.espece.familleId, culture.annee)
      }
    }
  }

  // Si azote appauvri, recommander fortement les Fabacées
  if (soilStatus.estimatedN === 'depleted' && !blockedIds.has('Fabacées')) {
    recommended.push({
      familleId: 'Fabacées',
      familleNom: 'Fabacées',
      familleCouleur:
        allFamilies.find((f) => f.id === 'Fabacées')?.couleur ?? '#22c55e',
      reason: 'Fixe l\'azote - idéal après cultures gourmandes',
      score: 95,
    })
  }

  // Ajouter toutes les familles non bloquées
  for (const famille of allFamilies) {
    if (blockedIds.has(famille.id)) continue
    if (recommended.find((r) => r.familleId === famille.id)) continue

    const lastUsed = familyLastUsed.get(famille.id)
    const yearsSinceUse = lastUsed ? targetYear - lastUsed : 100

    let score = Math.min(100, yearsSinceUse * 15)
    let reason = ''

    if (!lastUsed) {
      reason = 'Jamais utilisé sur cette planche'
      score = 80
    } else if (yearsSinceUse >= 5) {
      reason = `Non utilisé depuis ${yearsSinceUse} ans`
    } else {
      reason = `Dernière utilisation en ${lastUsed}`
    }

    // Bonus si le sol est enrichi et la famille est gourmande
    if (
      soilStatus.estimatedN === 'enriched' &&
      ['Solanacées', 'Cucurbitacées', 'Brassicacées'].includes(famille.id)
    ) {
      score = Math.min(100, score + 10)
      reason += ' - sol riche, idéal'
    }

    recommended.push({
      familleId: famille.id,
      familleNom: famille.id,
      familleCouleur: famille.couleur,
      reason,
      score,
    })
  }

  return recommended.sort((a, b) => b.score - a.score)
}

/**
 * Calcule le conseil pour une espèce spécifique
 */
function calculateEspeceAdvice(
  espece: { id: string; familleId: string | null; besoinN: number | null },
  blockedFamilies: BlockedFamily[],
  soilStatus: SoilAnalysis
): EspeceAdvice {
  const details: string[] = []

  // Vérifier si la famille est bloquée
  const blockedFamily = espece.familleId
    ? blockedFamilies.find((b) => b.familleId === espece.familleId)
    : null

  if (blockedFamily) {
    return {
      especeId: espece.id,
      familleId: espece.familleId,
      status: 'blocked',
      message: `Rotation non respectée pour ${blockedFamily.familleNom}`,
      details: [
        `Dernière culture de ${blockedFamily.familleNom} en ${blockedFamily.lastYear}`,
        `Intervalle requis : ${blockedFamily.intervalle} ans`,
        `Attendre jusqu'en ${blockedFamily.lastYear + blockedFamily.intervalle}`,
      ],
    }
  }

  // Vérifier les avertissements basés sur le sol
  if ((espece.besoinN ?? 0) >= 4 && soilStatus.estimatedN === 'depleted') {
    return {
      especeId: espece.id,
      familleId: espece.familleId,
      status: 'warning',
      message: 'Culture gourmande sur sol appauvri',
      details: [
        `${espece.id} a un besoin élevé en azote (${espece.besoinN}/5)`,
        'Le sol est estimé appauvri en azote',
        'Envisagez une fertilisation ou une légumineuse avant',
      ],
    }
  }

  // Tout est OK
  details.push('Rotation respectée')
  if (espece.familleId) {
    details.push(`Famille : ${espece.familleId}`)
  }
  if (soilStatus.estimatedN === 'enriched' && (espece.besoinN ?? 0) >= 4) {
    details.push('Sol riche en azote - conditions idéales')
  }

  return {
    especeId: espece.id,
    familleId: espece.familleId,
    status: 'safe',
    message: 'Culture recommandée',
    details,
  }
}

/**
 * Fonction principale de calcul des conseils de rotation
 */
export function calculateRotationAdvice(ctx: RotationContext): RotationAdvice {
  const { plancheId, targetYear, cultures, allFamilies, especeToCheck } = ctx

  // Calculer l'état du sol
  const soilStatus = calculateSoilStatus(cultures, targetYear)

  // Calculer les familles bloquées
  const blockedFamilies = calculateBlockedFamilies(
    cultures,
    allFamilies,
    targetYear
  )

  // Calculer les familles recommandées
  const recommendedFamilies = calculateRecommendedFamilies(
    cultures,
    allFamilies,
    blockedFamilies,
    soilStatus,
    targetYear
  )

  // Cultures récentes pour référence
  const recentCultures = cultures
    .filter((c) => c.annee >= targetYear - 5)
    .map((c) => ({
      annee: c.annee,
      familleId: c.espece.familleId,
      especeId: c.especeId,
      besoinN: c.espece.besoinN,
    }))
    .sort((a, b) => b.annee - a.annee)

  // Conseil pour une espèce spécifique si demandé
  let especeAdvice: EspeceAdvice | undefined
  if (especeToCheck) {
    especeAdvice = calculateEspeceAdvice(
      especeToCheck,
      blockedFamilies,
      soilStatus
    )
  }

  return {
    plancheId,
    targetYear,
    recentCultures,
    blockedFamilies,
    recommendedFamilies,
    soilStatus,
    especeAdvice,
  }
}

export * from './types'
