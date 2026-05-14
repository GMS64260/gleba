/**
 * Service de qualité du sol
 * Calcul scores, influence irrigation/fertilisation
 * Enrichi avec données météo réelles (Open-Meteo)
 */

export interface SoilQuality {
  typeSol: 'Argileux' | 'Limoneux' | 'Sableux' | 'Mixte'
  retentionEau: 'Faible' | 'Moyenne' | 'Élevée'
  scoreRetention: number // 0-100
  argile: number // %
  limon: number // %
  sable: number // %
  ph?: number
  carboneOrg?: number
}

/**
 * Détermine le type de sol depuis les % texture
 * Triangle textural simplifié
 */
export function determinerTypeSol(argile: number, limon: number, sable: number): SoilQuality['typeSol'] {
  // Triangle textural USDA simplifié
  if (argile > 40) return 'Argileux'
  if (sable > 70) return 'Sableux'
  if (limon > 50) return 'Limoneux'
  return 'Mixte'
}

/**
 * Calcule la rétention en eau selon texture
 * Basé sur capacité au champ (field capacity)
 */
export function calculerRetentionEau(argile: number, limon: number, sable: number): {
  niveau: SoilQuality['retentionEau']
  score: number
} {
  // Score = capacité de rétention (0-100)
  // Formule simplifiée : argile apporte +, sable enlève -, limon optimal
  const score = Math.max(0, Math.min(100,
    (argile * 1.2) +      // Argile retient bien l'eau
    (limon * 1.0) +       // Limon retient moyennement
    (sable * 0.3) -       // Sable retient peu
    20                    // Offset pour calibrage
  ))

  // Classification
  if (score < 30) return { niveau: 'Faible', score }
  if (score < 60) return { niveau: 'Moyenne', score }
  return { niveau: 'Élevée', score }
}

/**
 * Calcule les facteurs d'ajustement pour l'irrigation
 * selon le type de sol
 */
export function getIrrigationFactors(retentionEau: string): {
  frequenceFactor: number // Multiplicateur fréquence (1.0 = normal)
  quantiteFactor: number // Multiplicateur quantité (1.0 = normal)
  urgenceFactor: number // Multiplicateur urgence (1.0 = normal)
} {
  switch (retentionEau) {
    case 'Faible':
      // Sol sableux : arroser plus souvent, plus de volume, urgence +
      return {
        frequenceFactor: 1.5,  // 50% plus fréquent
        quantiteFactor: 1.2,   // 20% plus d'eau
        urgenceFactor: 1.3,    // Urgence arrive 30% plus vite
      }

    case 'Élevée':
      // Sol argileux : espacer arrosages, moins de volume, urgence -
      return {
        frequenceFactor: 0.7,  // 30% moins fréquent
        quantiteFactor: 0.8,   // 20% moins d'eau
        urgenceFactor: 0.8,    // Urgence arrive 20% plus lentement
      }

    case 'Moyenne':
    default:
      // Sol limoneux ou mixte : valeurs normales
      return {
        frequenceFactor: 1.0,
        quantiteFactor: 1.0,
        urgenceFactor: 1.0,
      }
  }
}

/**
 * Calcule la consommation d'eau ajustée selon le sol
 */
export function calculerConsommationEauAvecSol(
  surface: number,
  besoinEauEspece: number,
  retentionEauSol: string | null
): number {
  // Consommation de base selon besoin espece (L/m²/semaine)
  const consommationBase = besoinEauEspece >= 4 ? 15 : besoinEauEspece >= 3 ? 10 : 5

  const factors = getIrrigationFactors(retentionEauSol || 'Moyenne')

  // Ajuster selon le sol
  return surface * consommationBase * factors.quantiteFactor
}

/**
 * Évaluer si alerte sécheresse necessaire
 * Combinaison: sol faible rétention + pas pluie + culture exigeante
 */
export function alerteSecheresse(
  joursSansEau: number | null,
  retentionEauSol: string | null,
  besoinEauEspece: number,
  joursSansPluie: number = 0
): boolean {
  if (retentionEauSol !== 'Faible') return false
  if (besoinEauEspece < 3) return false
  if (joursSansEau === null) return true

  // Sol sableux + culture exigeante + 7j sans pluie + 2j sans arrosage
  return joursSansPluie >= 7 && joursSansEau >= 2
}

/**
 * Calcule la consommation d'eau recommandée en intégrant les données météo
 * Retourne des L/m²/semaine ajustés
 */
export function calculerConsommationEauAvecMeteo(
  surface: number,
  besoinEauEspece: number,
  retentionEauSol: string | null,
  meteo: {
    et0Journalier: number     // mm/jour (évapotranspiration du jour)
    precipitations7j: number  // mm de pluie sur 7 jours
  }
): { litres: number; message: string } {
  const factors = getIrrigationFactors(retentionEauSol || 'Moyenne')

  // Calcul basé sur l'ET0 réelle au lieu de valeurs forfaitaires
  // ETc = ET0 × Kc (coefficient cultural simplifié basé sur besoinEau)
  const kc = 0.4 + (besoinEauEspece / 5) * 0.8 // Kc entre 0.4 et 1.2
  const etcJournalier = meteo.et0Journalier * kc

  // Besoin hebdomadaire en L/m² = ETc × 7 jours
  let besoinHebdo = etcJournalier * 7

  // Déduire les précipitations effectives (80% des précipitations sont utiles)
  const precipEfficace = meteo.precipitations7j * 0.8
  besoinHebdo = Math.max(0, besoinHebdo - precipEfficace)

  // Ajuster selon le sol
  besoinHebdo *= factors.quantiteFactor

  const litres = Math.round(surface * besoinHebdo * 10) / 10

  // Message explicatif
  let message: string
  if (besoinHebdo <= 0) {
    message = 'Les précipitations couvrent les besoins en eau cette semaine.'
  } else if (besoinHebdo < 5) {
    message = `Arrosage léger recommandé : ${Math.round(besoinHebdo)} L/m²/semaine.`
  } else if (besoinHebdo < 15) {
    message = `Arrosage régulier necessaire : ${Math.round(besoinHebdo)} L/m²/semaine.`
  } else {
    message = `Arrosage intensif requis : ${Math.round(besoinHebdo)} L/m²/semaine. Privilégier le goutte-à-goutte.`
  }

  return { litres, message }
}

