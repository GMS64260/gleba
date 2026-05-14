/**
 * PROMPT 06 — Calcul des besoins en semences, plants et caieux.
 *
 * Une seule fonction pure `calculerBesoin` couvre les 3 modes :
 *   - graine_directe : besoin_g  = surface_m2 × dose_g_par_m2 × (1 + marge)
 *   - plant_repique  : besoin_g  = (nb_plants / graines_par_gramme) × (1 + marge)
 *   - bulbe_caieu    : besoin_caieux = nb_plants  (PAS de calcul en grammes)
 *
 * Le code de planification appelle ce helper en passant les valeurs déjà
 * agrégées par espèce/variété, ce qui rend la logique testable sans toucher
 * à la BDD.
 */

export type ModeSemis = 'graine_directe' | 'plant_repique' | 'bulbe_caieu' | 'bouture'

export type StatutSemence = 'OK' | 'LOW' | 'MISSING' | 'IGNORE'

export interface BesoinSemenceInput {
  mode: ModeSemis | null | undefined
  /** Surface cumulée pour ce besoin (m²). */
  surfaceM2: number
  /** Nombre de plants cumulés pour ce besoin. */
  nbPlants: number
  /** Dose recommandée (g/m²) — utilisée pour `graine_directe`. */
  doseGParM2?: number | null
  /** Densité de graines (graines/g) — utilisée pour `plant_repique`. */
  grainesParGramme?: number | null
  /** Marge de sécurité en pourcentage (0-100). Défaut : 15 %. */
  margeSecuritePct?: number | null
  /** Stock actuel en grammes (modes graine). */
  stockGrammes?: number | null
  /** Stock actuel en plants/caieux (mode bulbe_caieu). */
  stockUnites?: number | null
}

export interface BesoinSemenceResult {
  mode: ModeSemis
  besoinGrammes: number      // 0 si mode bulbe_caieu
  besoinCaieux: number       // 0 si mode graine_*
  surfaceM2: number
  nbPlants: number
  margeSecuritePct: number
  stockGrammes: number
  stockUnites: number
  manqueGrammes: number      // max(0, besoinGrammes - stockGrammes)
  manqueCaieux: number       // max(0, besoinCaieux - stockUnites)
  statut: StatutSemence
}

const DEFAULT_MARGE = 15

export function calculerBesoin(input: BesoinSemenceInput): BesoinSemenceResult {
  const mode: ModeSemis = (input.mode ?? 'graine_directe') as ModeSemis
  const marge = Math.max(0, input.margeSecuritePct ?? DEFAULT_MARGE)
  const margeFactor = 1 + marge / 100

  const surfaceM2 = Math.max(0, input.surfaceM2 ?? 0)
  const nbPlants = Math.max(0, input.nbPlants ?? 0)
  const stockGrammes = Math.max(0, input.stockGrammes ?? 0)
  const stockUnites = Math.max(0, input.stockUnites ?? 0)

  let besoinGrammes = 0
  let besoinCaieux = 0

  switch (mode) {
    case 'graine_directe': {
      const dose = input.doseGParM2 ?? 0
      if (dose > 0 && surfaceM2 > 0) {
        besoinGrammes = round2(surfaceM2 * dose * margeFactor)
      }
      break
    }

    case 'plant_repique': {
      const gpg = input.grainesParGramme ?? 0
      if (gpg > 0 && nbPlants > 0) {
        besoinGrammes = round2((nbPlants / gpg) * margeFactor)
      }
      break
    }

    case 'bulbe_caieu': {
      // Pas de calcul en grammes : on commande des unités (caieux/bulbes).
      besoinCaieux = nbPlants > 0 ? Math.ceil(nbPlants * margeFactor) : 0
      break
    }

    case 'bouture': {
      // Boutures : pour l'instant, comptage en unités sans marge.
      besoinCaieux = nbPlants
      break
    }
  }

  const manqueGrammes = Math.max(0, round2(besoinGrammes - stockGrammes))
  const manqueCaieux = Math.max(0, besoinCaieux - stockUnites)

  return {
    mode,
    besoinGrammes,
    besoinCaieux,
    surfaceM2,
    nbPlants,
    margeSecuritePct: marge,
    stockGrammes,
    stockUnites,
    manqueGrammes,
    manqueCaieux,
    statut: computeStatut(mode, besoinGrammes, besoinCaieux, stockGrammes, stockUnites),
  }
}

function computeStatut(
  mode: ModeSemis,
  besoinG: number,
  besoinC: number,
  stockG: number,
  stockC: number
): StatutSemence {
  if (mode === 'bulbe_caieu' || mode === 'bouture') {
    if (besoinC === 0) return 'IGNORE'
    if (stockC === 0) return 'MISSING'
    if (stockC < besoinC) return 'LOW'
    return 'OK'
  }
  if (besoinG === 0) return 'IGNORE'
  if (stockG === 0) return 'MISSING'
  if (stockG < besoinG) return 'LOW'
  return 'OK'
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
