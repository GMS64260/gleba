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
 *
 * Audit Marc 2026-05-14 — Ajout du champ `uniteDose` pour distinguer
 * les dosages en g/m², plants/m², graines/godet ou caieux/m².
 */

export type ModeSemis = 'graine_directe' | 'plant_repique' | 'bulbe_caieu' | 'bouture'

export type UniteDose = 'g_m2' | 'pieces_m2' | 'graines_plant' | 'caieux_m2'

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
  /**
   * Unité dans laquelle est exprimée `doseGParM2`. Permet de gérer les cas
   * où le référentiel donne ex. 2 graines/godet (pépinière) ou 4 plants/m²
   * (repiquage) ou 20 caieux/m² (ail). Si null, on retombe sur la convention
   * historique (g/m² en mode graine_directe, graines/g via `grainesParGramme`).
   */
  uniteDose?: UniteDose | null
  /** Taux de germination réaliste de l'espèce (mémo pour tooltip UI). */
  tauxGerminationPct?: number | null
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

  // L'unité de la dose détermine l'interprétation. Si le référentiel ne la
  // précise pas, on retombe sur la convention historique (g/m² en mode
  // graine_directe).
  const uniteDose: UniteDose | null = input.uniteDose ?? null

  switch (mode) {
    case 'graine_directe': {
      const dose = input.doseGParM2 ?? 0
      if (dose > 0 && surfaceM2 > 0) {
        if (uniteDose === 'pieces_m2') {
          // Dose = plants/m² : on commande des plants/boutures (unités entières)
          besoinCaieux = Math.ceil(surfaceM2 * dose * margeFactor)
        } else {
          // g/m² par défaut
          besoinGrammes = round2(surfaceM2 * dose * margeFactor)
        }
      }
      break
    }

    case 'plant_repique': {
      // Deux conventions selon le référentiel :
      // - uniteDose=graines_plant : `doseGParM2` est en graines/godet,
      //   total = nbPlants × graines/godet, converti en grammes via
      //   grainesParGramme (de la variété). Si pas de graines/g connu,
      //   on commande en unités (besoinCaieux).
      // - sinon : ancien comportement nbPlants / grainesParGramme.
      const gpg = input.grainesParGramme ?? 0
      if (uniteDose === 'graines_plant') {
        const grainesPlant = input.doseGParM2 ?? 1
        const totalGraines = nbPlants * grainesPlant
        if (gpg > 0 && totalGraines > 0) {
          besoinGrammes = round2((totalGraines / gpg) * margeFactor)
        } else if (totalGraines > 0) {
          besoinCaieux = Math.ceil(totalGraines * margeFactor)
        }
      } else if (gpg > 0 && nbPlants > 0) {
        besoinGrammes = round2((nbPlants / gpg) * margeFactor)
      }
      break
    }

    case 'bulbe_caieu': {
      // Feedback Marc 2026-05-16 — V3 Bug 7 : pour l'oignon, l'ail ou la
      // pomme de terre planté(e)s en bulbille/tubercule, 1 caïeu = 1
      // plant. La règle « surface × dose_caieux/m² » donnait 991
      // caïeux pour 30 m² alors que `nbPlants` valait 414, ce qui
      // confondait l'utilisateur (les deux KPIs sont censés représenter
      // la même chose). On privilégie désormais `nbPlants × marge`
      // quand `nbPlants > 0`, et on retombe sur `surface × dose` seulement
      // si la culture n'a pas de nbRangs/espacement saisis.
      if (nbPlants > 0) {
        besoinCaieux = Math.ceil(nbPlants * margeFactor)
      } else if (uniteDose === 'caieux_m2' && surfaceM2 > 0 && (input.doseGParM2 ?? 0) > 0) {
        besoinCaieux = Math.ceil(surfaceM2 * (input.doseGParM2 as number) * margeFactor)
      } else {
        besoinCaieux = 0
      }
      break
    }

    case 'bouture': {
      // Boutures : comptage en unités sans marge.
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
  // En modes graine_*, on peut avoir un besoin exprimé en grammes OU en
  // unités (graines à acheter à l'unité). On considère "absent" si les
  // deux compteurs sont à zéro.
  if (besoinG === 0 && besoinC === 0) return 'IGNORE'
  if (besoinG > 0) {
    if (stockG === 0) return 'MISSING'
    if (stockG < besoinG) return 'LOW'
    return 'OK'
  }
  // besoinC > 0 (cas pieces_m2)
  if (stockC === 0) return 'MISSING'
  if (stockC < besoinC) return 'LOW'
  return 'OK'
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
