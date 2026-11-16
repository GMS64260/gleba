/**
 * Froid hivernal et chaleur printanière des arbres fruitiers, à partir de
 * températures horaires (voir `heures.ts`).
 *
 * Trois mesures du froid, de la plus simple à la plus fiable :
 *  - heures de froid (Weinberger 1950) : heures entre 0 et 7,2 °C, l'unité des
 *    catalogues de pépiniéristes ;
 *  - unités Utah (Richardson et al. 1974) : heures pondérées, les heures douces
 *    annulent du froid ;
 *  - portions de froid du modèle dynamique (Fishman et al. 1987, Erez et al.
 *    1990) : le froid s'acquiert en deux temps, et un redoux ne détruit que le
 *    froid encore en cours d'acquisition. C'est la mesure à privilégier,
 *    surtout en hiver doux.
 *
 * La chaleur se compte en « growing degree hours » (Anderson et al. 1986).
 *
 * Les constantes et l'ordre des calculs reprennent le paquet R `chillR`
 * (fonction `chilling`), référence du domaine.
 */

/** Heures de froid : 1 par heure entre 0 et 7,2 °C. */
export function heuresDeFroid(temperature: number): number {
  return temperature >= 0 && temperature <= 7.2 ? 1 : 0
}

/** Unités Utah d'une heure. */
export function uniteUtah(temperature: number): number {
  if (temperature <= 1.4) return 0
  if (temperature <= 2.4) return 0.5
  if (temperature <= 9.1) return 1
  if (temperature <= 12.4) return 0.5
  if (temperature <= 15.9) return 0
  if (temperature <= 18) return -0.5
  return -1
}

const E0 = 4153.5
const E1 = 12888.8
const A0 = 139500
const A1 = 2.567e18
const PENTE = 1.6
const T_FUSION = 277

/**
 * Portions de froid acquises à chaque heure (modèle dynamique). La première
 * heure n'en produit jamais : le modèle part d'un état vide.
 */
export function portionsDeFroidHoraires(temperatures: readonly number[]): number[] {
  const n = temperatures.length
  const portions = new Array<number>(n).fill(0)
  let intermediaire = 0
  let fractionFixeePrecedente = 0

  for (let l = 0; l < n; l++) {
    const tk = temperatures[l] + 273
    const sr = Math.exp((PENTE * T_FUSION * (tk - T_FUSION)) / tk)
    const fractionFixee = sr / (1 + sr)
    if (l > 0) {
      const equilibre = (A0 / A1) * Math.exp((E1 - E0) / tk)
      const vitesse = A1 * Math.exp(-E1 / tk)
      const depart = intermediaire < 1 ? intermediaire : intermediaire * (1 - fractionFixeePrecedente)
      intermediaire = equilibre - (equilibre - depart) * Math.exp(-vitesse)
      if (intermediaire >= 1) portions[l] = intermediaire * fractionFixee
    }
    fractionFixeePrecedente = fractionFixee
  }
  return portions
}

const BASE = 4
const OPTIMUM = 25
const CRITIQUE = 36

/** Chaleur utile d'une heure (growing degree hours). */
export function chaleurHoraire(temperature: number): number {
  if (temperature < BASE || temperature > CRITIQUE) return 0
  if (temperature <= OPTIMUM) {
    return ((OPTIMUM - BASE) / 2) * (1 + Math.cos(Math.PI + (Math.PI * (temperature - BASE)) / (OPTIMUM - BASE)))
  }
  return (
    (OPTIMUM - BASE) *
    (1 + Math.cos(Math.PI / 2 + ((Math.PI / 2) * (temperature - OPTIMUM)) / (CRITIQUE - OPTIMUM)))
  )
}

export interface CumulsJour {
  heuresFroid: number
  unitesUtah: number
  portionsFroid: number
  chaleur: number
}

/**
 * Cumuls à la fin de chaque jour d'une série horaire continue (24 valeurs par
 * jour). Le froid part de zéro au premier jour de la série : commencer la série
 * au début de la saison de repos, pas au 1er janvier.
 */
export function cumulsQuotidiens(temperatures: readonly number[]): CumulsJour[] {
  const portions = portionsDeFroidHoraires(temperatures)
  const jours: CumulsJour[] = []
  let heuresFroid = 0
  let unitesUtah = 0
  let portionsFroid = 0
  let chaleur = 0
  for (let i = 0; i < temperatures.length; i++) {
    const t = temperatures[i]
    heuresFroid += heuresDeFroid(t)
    unitesUtah += uniteUtah(t)
    portionsFroid += portions[i]
    chaleur += chaleurHoraire(t)
    if (i % 24 === 23) jours.push({ heuresFroid, unitesUtah, portionsFroid, chaleur })
  }
  return jours
}
