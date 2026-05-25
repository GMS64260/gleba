/**
 * Bibliotheque de calcul pour la planification des cultures
 * Logique metier basee sur potaleger_old
 */

import prisma from '@/lib/prisma'
import { calculerDateDepuisSemaine } from './assistant-helpers'
import { alertesAssociations } from './associations-alertes'

/**
 * Bug #4 — Si la planche n'a pas d'îlot explicite, dériver depuis le préfixe
 * alpha du nom (A1 → A, B3 → B, Rang 01 → Rang). Évite que l'écran
 * "Par planches" affiche "-" sur l'intégralité des lignes pour les utilisateurs
 * qui n'ont pas formalisé leurs îlots.
 */
function deriveIlot(ilot: string | null, nom: string | null | undefined): string | null {
  if (ilot && ilot.trim().length > 0) return ilot
  if (!nom) return null
  const match = nom.match(/^[A-Za-zÀ-ÿ]+/)
  return match ? match[0] : null
}

// ============================================================
// TYPES
// ============================================================

export interface CulturePrevue {
  plancheId: string
  plancheLongueur: number | null
  plancheLargeur: number | null
  plancheSurface: number | null
  ilot: string | null
  rotationId: string | null
  rotationAnnee: number // Annee dans le cycle (1, 2, 3...)
  itpId: string | null
  especeId: string | null
  especeCouleur: string | null
  varieteId: string | null
  annee: number // Annee reelle
  semaineSemis: number | null
  semainePlantation: number | null
  semaineRecolte: number | null
  dureeCulture: number | null
  nbRangs: number | null
  espacement: number | null
  surface: number
  existante: boolean // Culture deja creee ?
  cultureId: number | null // ID si existante
}

export interface RecoltePrevue {
  periode: string // "Janvier", "Fevrier"... ou "S1", "S2"...
  periodeNum: number // 1-12 pour mois, 1-52 pour semaines
  especes: {
    especeId: string
    especeCouleur: string | null
    quantite: number // kg
    surface: number // m2
  }[]
  totalKg: number
  totalSurface: number
}

export interface BesoinSemence {
  especeId: string
  especeCouleur: string | null
  varieteId: string | null
  surfaceTotale: number
  nbPlants: number
  /** Mode de propagation décidé par l'espèce (cf. `Espece.modeSemis`). */
  mode: 'graine_directe' | 'plant_repique' | 'bulbe_caieu' | 'bouture'
  /** Besoin en grammes — 0 si `mode === 'bulbe_caieu'`. */
  grainesNecessaires: number
  /** Besoin en caieux/bulbes/plants entiers — 0 si mode graine_*. */
  besoinCaieux: number
  margeSecuritePct: number
  /** Stock actuel en grammes (modes graine). */
  stockActuel: number
  /** Stock actuel en plants/caieux (modes bulbe_caieu / bouture). */
  stockUnites: number
  /** Nombre de graines par gramme (renseigné sur Variete). */
  nbGrainesG: number | null
  doseSemis: number | null
  /** Unité dans laquelle est exprimée la dose (cf. Espece.uniteDose). */
  uniteDose: 'g_m2' | 'pieces_m2' | 'graines_plant' | 'caieux_m2' | null
  /** Taux de germination réaliste (mémo pour tooltip marge). */
  tauxGerminationPct: number | null
  /** Manque à commander (en grammes pour modes graine). */
  aCommander: number
  /** Manque à commander (en unités pour mode bulbe_caieu). */
  caieuxACommander: number
  /** Statut métier : OK / LOW / MISSING / IGNORE. */
  statut: 'OK' | 'LOW' | 'MISSING' | 'IGNORE'
  /** Date de la dernière mise à jour du stock pour la variété (null si absent). */
  stockDateMaj: string | null
}

export interface BesoinPlant {
  especeId: string
  especeCouleur: string | null
  varieteId: string | null
  nbPlants: number
  semainePlantation: number | null
  stockActuel: number
  aCommander: number
  cultures: {
    plancheId: string
    surface: number
    nbPlants: number
  }[]
}

export interface AssociationCulture {
  plancheId: string
  ilot: string | null
  cultureEspeceId: string | null
  cultureSemaine: number | null
  planchesVoisines: string[]
  culturesVoisines: {
    plancheId: string
    especeId: string | null
    // Bug #6 — Évaluation de l'association culture⟷voisin pour signaler
    // les paires bénéfiques/néfastes (la promesse du bandeau d'info).
    eval: "favorable" | "defavorable" | "neutre"
    evalMessage: string | null
  }[]
  // Synthèse au niveau de la planche pour pouvoir trier / colorer la ligne.
  scoreAssociation: "favorable" | "defavorable" | "mixte" | "neutre"
}

// ============================================================
// FONCTIONS UTILITAIRES
// ============================================================

/**
 * Calcule l'annee reelle a partir de l'annee de base et de l'annee dans le cycle
 */
function calculerAnneeReelle(anneeBase: number, anneeCycle: number, nbAnneesCycle: number): number {
  // anneeCycle est 1-indexed (1, 2, 3...)
  // On utilise modulo pour gerer les cycles
  return anneeBase + (anneeCycle - 1)
}

/**
 * Calcule l'annee du cycle pour une annee donnee
 */
function calculerAnneeCycle(annee: number, anneeBase: number, nbAnneesCycle: number): number {
  if (nbAnneesCycle <= 0) return 1
  const diff = annee - anneeBase
  return ((diff % nbAnneesCycle) + nbAnneesCycle) % nbAnneesCycle + 1
}

/**
 * Calcule le nombre de plants pour une planche/ITP donne
 */
function calculerNbPlants(
  longueur: number | null,
  largeur: number | null,
  nbRangs: number | null,
  espacement: number | null
): number {
  if (!longueur || !nbRangs || !espacement) return 0
  // espacement en cm, longueur en m
  const longueurCm = longueur * 100
  const nbPlantsParRang = Math.floor(longueurCm / espacement)
  return nbPlantsParRang * nbRangs
}

/**
 * Convertit un numero de semaine en mois (1-12)
 */
function semainVersMois(semaine: number): number {
  // Approximation: 4.33 semaines par mois
  return Math.min(12, Math.max(1, Math.ceil(semaine / 4.33)))
}

/**
 * Convertit une date en numero de semaine ISO (1-53) — sert de fallback
 * quand Culture.semaineRecolte n'est pas fourni par un ITP rattache.
 */
function dateVersSemaine(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1)
  const diff = (d.getTime() - start.getTime()) / 86_400_000
  return Math.min(53, Math.max(1, Math.ceil((diff + start.getDay() + 1) / 7)))
}

const MOIS_NOMS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
]

// ============================================================
// FONCTIONS PRINCIPALES
// ============================================================

/**
 * Recupere les cultures prevues pour une annee donnee
 * Basee sur les rotations assignees aux planches
 */
export async function getCulturesPrevues(
  userId: string,
  annee: number,
  options?: {
    especeId?: string
    ilot?: string
    plancheId?: string
  }
): Promise<CulturePrevue[]> {
  // Mode 1: Cultures basées sur rotations
  const planches = await prisma.planche.findMany({
    where: {
      userId,
      rotationId: { not: null },
      ...(options?.ilot && { ilot: options.ilot }),
      ...(options?.plancheId && { nom: options.plancheId }),
    },
    include: {
      rotation: {
        include: {
          details: {
            include: {
              itp: {
                include: {
                  espece: true,
                },
              },
            },
            orderBy: { annee: 'asc' },
          },
        },
      },
      cultures: {
        where: { annee },
        select: {
          id: true,
          especeId: true,
          varieteId: true,
          itpId: true,
        },
      },
    },
  })

  const culturesPrevues: CulturePrevue[] = []

  // Determiner l'annee de base pour le calcul des rotations
  // On utilise l'annee courante comme reference
  const anneeBase = annee - 10 // On suppose que les rotations ont commence il y a max 10 ans

  for (const planche of planches) {
    if (!planche.rotation || planche.rotation.details.length === 0) continue

    const nbAnneesCycle = planche.rotation.nbAnnees || planche.rotation.details.length

    // Pour chaque detail de rotation
    for (const detail of planche.rotation.details) {
      // Calculer si cette annee du cycle correspond a l'annee demandee
      // On teste plusieurs cycles pour trouver une correspondance
      for (let cycleOffset = 0; cycleOffset <= 20; cycleOffset++) {
        const anneeReelle = anneeBase + (cycleOffset * nbAnneesCycle) + (detail.annee - 1)

        if (anneeReelle === annee) {
          // Filtrer par espece si demande
          if (options?.especeId && detail.itp?.especeId !== options.especeId) {
            continue
          }

          const surface = (planche.longueur || 0) * (planche.largeur || 0)

          // Verifier si une culture existe deja
          const cultureExistante = planche.cultures.find(
            c => c.itpId === detail.itpId || c.especeId === detail.itp?.especeId
          )

          culturesPrevues.push({
            plancheId: planche.nom,
            plancheLongueur: planche.longueur,
            plancheLargeur: planche.largeur,
            plancheSurface: planche.surface,
            ilot: deriveIlot(planche.ilot, planche.nom),
            rotationId: planche.rotationId,
            rotationAnnee: detail.annee,
            itpId: detail.itpId,
            especeId: detail.itp?.especeId || null,
            especeCouleur: detail.itp?.espece?.couleur || null,
            varieteId: null, // A definir lors de la creation
            annee,
            semaineSemis: detail.itp?.semaineSemis || null,
            semainePlantation: detail.itp?.semainePlantation || null,
            semaineRecolte: detail.itp?.semaineRecolte || null,
            dureeCulture: detail.itp?.dureeCulture || null,
            nbRangs: detail.itp?.nbRangs || null,
            espacement: detail.itp?.espacement || null,
            surface,
            existante: !!cultureExistante,
            cultureId: cultureExistante?.id || null,
          })
          break // Sortir de la boucle cycleOffset
        }
      }
    }
  }

  // Mode 2: Cultures directes (sans rotation)
  const culturesDirectes = await prisma.culture.findMany({
    where: {
      userId,
      annee,
      ...(options?.especeId && { especeId: options.especeId }),
      ...(options?.plancheId && { planche: { nom: options.plancheId } }),
      ...(options?.ilot && { planche: { ilot: options.ilot } }),
    },
    include: {
      espece: {
        select: {
          id: true,
          couleur: true,
          rendement: true,
        },
      },
      itp: true,
      planche: true,
      variete: true,
    },
  })

  // Ajouter les cultures directes qui ne sont pas déjà dans les prevues (via rotation)
  for (const culture of culturesDirectes) {
    // Vérifier si déjà ajoutée via rotation
    const dejaPresente = culturesPrevues.some(cp =>
      cp.plancheId === culture.plancheId && cp.cultureId === culture.id
    )

    if (!dejaPresente && culture.planche) {
      const surface = (culture.planche.longueur || 0) * (culture.planche.largeur || 0)

      culturesPrevues.push({
        plancheId: culture.planche.nom || culture.plancheId || '',
        plancheLongueur: culture.planche.longueur,
        plancheLargeur: culture.planche.largeur,
        plancheSurface: culture.planche.surface,
        ilot: deriveIlot(culture.planche.ilot, culture.planche.nom),
        rotationId: culture.planche.rotationId,
        rotationAnnee: 0, // Pas de rotation
        itpId: culture.itpId,
        especeId: culture.especeId,
        especeCouleur: culture.espece?.couleur || null,
        varieteId: culture.varieteId,
        annee: culture.annee || annee,
        semaineSemis: culture.itp?.semaineSemis ?? (culture.dateSemis ? dateVersSemaine(culture.dateSemis) : null),
        semainePlantation:
          culture.itp?.semainePlantation
          ?? (culture.datePlantation ? dateVersSemaine(culture.datePlantation) : null),
        // BUG-feedback (Marc 2026-05-16) : sans ITP rattaché, la culture
        // était ignorée par les KPI "Récoltes prévues" alors que la date
        // de récolte est saisie. Fallback systématique sur dateRecolte.
        semaineRecolte:
          culture.itp?.semaineRecolte
          ?? (culture.dateRecolte ? dateVersSemaine(culture.dateRecolte) : null),
        dureeCulture: culture.itp?.dureeCulture || null,
        nbRangs: culture.nbRangs || culture.itp?.nbRangs || null,
        espacement: culture.espacement || culture.itp?.espacement || null,
        surface: culture.longueur && culture.planche.largeur && culture.nbRangs
          ? (culture.longueur * culture.planche.largeur * culture.nbRangs) / (culture.nbRangs || 1)
          : surface,
        existante: true, // Culture déjà créée
        cultureId: culture.id,
      })
    }
  }

  return culturesPrevues
}

/**
 * Recupere les recoltes prevues groupees par mois ou semaine
 */
export async function getRecoltesPrevues(
  userId: string,
  annee: number,
  groupBy: 'mois' | 'semaine' = 'mois'
): Promise<RecoltePrevue[]> {
  const culturesPrevues = await getCulturesPrevues(userId, annee)

  // Grouper par periode
  const groupedMap = new Map<number, {
    especes: Map<string, { especeId: string; especeCouleur: string | null; quantite: number; surface: number }>
  }>()

  // Recuperer les rendements des especes
  const especeIds = [...new Set(culturesPrevues.map(c => c.especeId).filter(Boolean))]
  const especes = await prisma.espece.findMany({
    where: { id: { in: especeIds as string[] } },
    select: { id: true, rendement: true, couleur: true },
  })
  const especeMap = new Map(especes.map(e => [e.id, e]))

  for (const culture of culturesPrevues) {
    if (!culture.semaineRecolte || !culture.especeId) continue

    const periodeNum = groupBy === 'mois'
      ? semainVersMois(culture.semaineRecolte)
      : culture.semaineRecolte

    if (!groupedMap.has(periodeNum)) {
      groupedMap.set(periodeNum, { especes: new Map() })
    }

    const group = groupedMap.get(periodeNum)!
    const especeData = especeMap.get(culture.especeId)
    const rendement = especeData?.rendement || 0

    const quantite = culture.surface * rendement
    const key = culture.especeId

    if (!group.especes.has(key)) {
      group.especes.set(key, {
        especeId: culture.especeId,
        especeCouleur: culture.especeCouleur,
        quantite: 0,
        surface: 0,
      })
    }

    const especeGroup = group.especes.get(key)!
    especeGroup.quantite += quantite
    especeGroup.surface += culture.surface
  }

  // Convertir en tableau
  const result: RecoltePrevue[] = []
  const maxPeriode = groupBy === 'mois' ? 12 : 52

  for (let i = 1; i <= maxPeriode; i++) {
    const group = groupedMap.get(i)
    const especesArray = group ? Array.from(group.especes.values()) : []

    result.push({
      // Bug cmp8scj32 (Marc 2026-05-16) — uniformisation format semaine
      // (padStart 2) pour cohérence avec formatSemaine() et tri texte stable.
      periode: groupBy === 'mois' ? MOIS_NOMS[i - 1] : `S${i.toString().padStart(2, '0')}`,
      periodeNum: i,
      especes: especesArray,
      totalKg: especesArray.reduce((sum, e) => sum + e.quantite, 0),
      totalSurface: especesArray.reduce((sum, e) => sum + e.surface, 0),
    })
  }

  return result
}

/**
 * Calcule les besoins en semences pour une annee.
 *
 * Refactor PROMPT 06 : on délègue le calcul à `calculerBesoin` qui couvre
 * les 3 modes (graine_directe, plant_repique, bulbe_caieu) et applique une
 * marge de sécurité paramétrée sur l'espèce.
 */
export async function getBesoinsSemences(
  userId: string,
  annee: number
): Promise<BesoinSemence[]> {
  const { calculerBesoin } = await import('./semences/calcul')
  const culturesPrevues = await getCulturesPrevues(userId, annee)

  // Référentiel : modes/dose par espèce, graines/g par variété, stocks user.
  // Feedback Marc 2026-05-16 — Bug 12 : on ajoute `densite` au select
  // pour pouvoir calculer nbPlants à partir de surface × densite quand
  // les ITPs/cultures n'ont pas nbRangs/espacement renseignés.
  const [especes, varietes, userStocks] = await Promise.all([
    prisma.espece.findMany({
      select: {
        id: true,
        couleur: true,
        modeSemis: true,
        doseSemis: true,
        uniteDose: true,
        tauxGermination: true,
        margeSecuritePct: true,
        densite: true,
        famille: { select: { couleur: true } },
      },
    }),
    prisma.variete.findMany({
      select: { id: true, especeId: true, nbGrainesG: true },
    }),
    prisma.userStockVariete.findMany({
      where: { userId },
      select: {
        varieteId: true,
        stockGraines: true,
        stockPlants: true,
        dateStock: true,
      },
    }),
  ])
  const especeMap = new Map(especes.map(e => [e.id, e]))
  const varieteMap = new Map(varietes.map(v => [v.id, v]))
  const userStockMap = new Map(userStocks.map(us => [us.varieteId, us]))

  // Feedback Marc 2026-05-16 — Bug 12 : fallback ITP référentiel quand
  // la culture n'a ni nbRangs ni espacement (cas le plus courant
  // tant qu'aucun ITP n'est rattaché).
  const especeIdsForFallback = [
    ...new Set(culturesPrevues.map(c => c.especeId).filter(Boolean) as string[]),
  ]
  const itpsForFallback = await prisma.iTP.findMany({
    where: {
      especeId: { in: especeIdsForFallback },
      nbRangs: { not: null },
      espacement: { not: null },
    },
    select: { especeId: true, nbRangs: true, espacement: true },
    orderBy: { dureeCulture: 'desc' },
  })
  const itpFallbackSemences = new Map<string, { nbRangs: number; espacement: number }>()
  for (const itp of itpsForFallback) {
    if (!itp.especeId || itpFallbackSemences.has(itp.especeId)) continue
    if (itp.nbRangs && itp.espacement) {
      itpFallbackSemences.set(itp.especeId, { nbRangs: itp.nbRangs, espacement: itp.espacement })
    }
  }

  // BUG-21 (audit Marc 2026-05-14) : double comptage de surface quand
  // plusieurs cultures partagent une même planche dans l'année (rotation
  // courte, ITPs multiples). Avant : Carotte 30 m² (B1) + Actinidia 30 m²
  // (B1) ⇒ besoins calculés sur 60 m² alors que la planche fait 30 m².
  // Fix prorata simple : la surface de chaque culture sur la planche est
  // pondérée par 1/N où N = nombre d'entrées sur la même planche.
  const culturesParPlanche = new Map<string, number>()
  for (const c of culturesPrevues) {
    if (!c.plancheId) continue
    culturesParPlanche.set(c.plancheId, (culturesParPlanche.get(c.plancheId) ?? 0) + 1)
  }

  // Accumulation par couple espèce + variété.
  type Acc = {
    especeId: string
    especeCouleur: string | null
    varieteId: string | null
    surfaceTotale: number
    nbPlants: number
  }
  const accMap = new Map<string, Acc>()
  for (const culture of culturesPrevues) {
    if (!culture.especeId) continue
    const key = `${culture.especeId}|${culture.varieteId || ''}`
    // Feedback Marc 2026-05-16 — Bug 12 : fallback nbRangs/espacement
    // (ITP référentiel) + fallback final densite (plants/m²) pour ne
    // pas retourner nbPlants=0 quand la culture est incomplètement
    // saisie.
    const fb = itpFallbackSemences.get(culture.especeId)
    const nbRangs = culture.nbRangs ?? fb?.nbRangs ?? null
    const espacement = culture.espacement ?? fb?.espacement ?? null
    let nbPlants = calculerNbPlants(
      culture.plancheLongueur,
      culture.plancheLargeur,
      nbRangs,
      espacement
    )
    if (nbPlants === 0) {
      const dens = especeMap.get(culture.especeId)?.densite
      if (dens && culture.surface > 0) {
        nbPlants = Math.ceil(culture.surface * dens)
      }
    }
    const partageFactor = culture.plancheId
      ? 1 / (culturesParPlanche.get(culture.plancheId) ?? 1)
      : 1
    const cur = accMap.get(key) || {
      especeId: culture.especeId,
      especeCouleur: culture.especeCouleur,
      varieteId: culture.varieteId,
      surfaceTotale: 0,
      nbPlants: 0,
    }
    cur.surfaceTotale += culture.surface * partageFactor
    cur.nbPlants += Math.round(nbPlants * partageFactor)
    accMap.set(key, cur)
  }

  // Pour chaque couple, on applique le mode déclaré sur l'espèce.
  const results: BesoinSemence[] = []
  for (const acc of accMap.values()) {
    const espece = especeMap.get(acc.especeId)
    const variete = acc.varieteId ? varieteMap.get(acc.varieteId) : null
    const stock = acc.varieteId ? userStockMap.get(acc.varieteId) : undefined

    const calc = calculerBesoin({
      mode: (espece?.modeSemis ?? 'graine_directe') as 'graine_directe' | 'plant_repique' | 'bulbe_caieu' | 'bouture',
      surfaceM2: acc.surfaceTotale,
      nbPlants: acc.nbPlants,
      doseGParM2: espece?.doseSemis ?? null,
      uniteDose: (espece?.uniteDose ?? null) as 'g_m2' | 'pieces_m2' | 'graines_plant' | 'caieux_m2' | null,
      tauxGerminationPct: espece?.tauxGermination ?? null,
      grainesParGramme: variete?.nbGrainesG ?? null,
      margeSecuritePct: espece?.margeSecuritePct ?? 15,
      stockGrammes: stock?.stockGraines ?? 0,
      stockUnites: stock?.stockPlants ?? 0,
    })

    results.push({
      especeId: acc.especeId,
      especeCouleur: acc.especeCouleur,
      varieteId: acc.varieteId,
      surfaceTotale: Math.round(acc.surfaceTotale * 10) / 10,
      nbPlants: acc.nbPlants,
      mode: calc.mode,
      grainesNecessaires: calc.besoinGrammes,
      besoinCaieux: calc.besoinCaieux,
      margeSecuritePct: calc.margeSecuritePct,
      stockActuel: calc.stockGrammes,
      stockUnites: calc.stockUnites,
      nbGrainesG: variete?.nbGrainesG ?? null,
      doseSemis: espece?.doseSemis ?? null,
      uniteDose: (espece?.uniteDose ?? null) as 'g_m2' | 'pieces_m2' | 'graines_plant' | 'caieux_m2' | null,
      tauxGerminationPct: espece?.tauxGermination ?? null,
      aCommander: calc.manqueGrammes,
      caieuxACommander: calc.manqueCaieux,
      statut: calc.statut,
      stockDateMaj: stock?.dateStock?.toISOString() ?? null,
    })
  }

  // Trier : on garde IGNORE en fin de liste, sinon par espèce/variété.
  return results
    .filter(b => b.statut !== 'IGNORE')
    .concat(results.filter(b => b.statut === 'IGNORE'))
    .sort((a, b) => {
      // IGNORE toujours après les autres.
      if (a.statut === 'IGNORE' && b.statut !== 'IGNORE') return 1
      if (b.statut === 'IGNORE' && a.statut !== 'IGNORE') return -1
      return a.especeId.localeCompare(b.especeId)
    })
}

/**
 * Calcule les besoins en plants pour une annee
 * (cultures avec plantation, pas semis direct)
 */
export async function getBesoinsPlants(
  userId: string,
  annee: number
): Promise<BesoinPlant[]> {
  const culturesPrevues = await getCulturesPrevues(userId, annee)

  // Filtrer les cultures avec plantation
  const culturesAvecPlantation = culturesPrevues.filter(
    c => c.semainePlantation !== null && c.especeId
  )

  // BUG #3 (audit Marc 2026-05-15) — Prorata identique à
  // `getBesoinsSemences` pour que les surfaces affichées dans
  // « Graines » et « Plants à produire » soient cohérentes
  // (sinon Plants montrait 4,8/9,6/12/30 m² brut, Graines montrait
  // 15 m² uniforme à cause du 1/N appliqué sur les planches partagées).
  const culturesParPlanche = new Map<string, number>()
  for (const c of culturesPrevues) {
    if (!c.plancheId) continue
    culturesParPlanche.set(c.plancheId, (culturesParPlanche.get(c.plancheId) ?? 0) + 1)
  }

  // BUG #4 — fallback nbRangs/espacement sur ITP référentiel par espèce
  // pour les cultures où les valeurs ne sont pas saisies (l'Aubergine
  // tombait à 0 plants alors qu'elle a 9,6 m² × densité 2/m² = 19).
  const especeIds = [...new Set(culturesAvecPlantation.map(c => c.especeId!).filter(Boolean))]
  const itpsParEspece = await prisma.iTP.findMany({
    where: { especeId: { in: especeIds }, nbRangs: { not: null }, espacement: { not: null } },
    select: { especeId: true, nbRangs: true, espacement: true },
    orderBy: { dureeCulture: 'desc' }, // ITP le plus long = plus représentatif
  })
  const itpFallback = new Map<string, { nbRangs: number; espacement: number }>()
  for (const itp of itpsParEspece) {
    if (!itp.especeId || itpFallback.has(itp.especeId)) continue
    if (itp.nbRangs && itp.espacement) {
      itpFallback.set(itp.especeId, { nbRangs: itp.nbRangs, espacement: itp.espacement })
    }
  }

  // Feedback Marc 2026-05-16 — Bug 12 : fallback densite (plants/m²)
  // quand ni la culture ni l'ITP ne fournissent nbRangs/espacement.
  const especesAvecDensite = await prisma.espece.findMany({
    where: { id: { in: especeIds }, densite: { not: null } },
    select: { id: true, densite: true },
  })
  const densiteFallback = new Map<string, number>()
  for (const e of especesAvecDensite) {
    if (e.densite) densiteFallback.set(e.id, e.densite)
  }

  // Recuperer les stocks par utilisateur
  const userStocks = await prisma.userStockVariete.findMany({
    where: { userId },
    select: { varieteId: true, stockGraines: true, stockPlants: true },
  })
  const userStockMap = new Map(userStocks.map(us => [us.varieteId, us]))

  // Grouper par espece/variete
  const besoinsMap = new Map<string, BesoinPlant>()

  for (const culture of culturesAvecPlantation) {
    if (!culture.especeId) continue

    const key = `${culture.especeId}|${culture.varieteId || ''}`
    const partageFactor = culture.plancheId
      ? 1 / (culturesParPlanche.get(culture.plancheId) ?? 1)
      : 1
    const surfaceEffective = culture.surface * partageFactor
    // BUG #4 — fallback ITP référentiel si nbRangs/espacement manquants
    const fb = itpFallback.get(culture.especeId)
    const nbRangs = culture.nbRangs ?? fb?.nbRangs ?? null
    const espacement = culture.espacement ?? fb?.espacement ?? null
    let nbPlantsBrut = calculerNbPlants(
      culture.plancheLongueur,
      culture.plancheLargeur,
      nbRangs,
      espacement
    )
    // Feedback Marc 2026-05-16 — Bug 12 : si ni la culture ni l'ITP ne
    // fournissent nbRangs/espacement, dériver depuis surface × densite.
    if (nbPlantsBrut === 0) {
      const dens = densiteFallback.get(culture.especeId)
      if (dens && culture.surface > 0) {
        nbPlantsBrut = Math.ceil(culture.surface * dens)
      }
    }
    const nbPlants = Math.round(nbPlantsBrut * partageFactor)

    if (!besoinsMap.has(key)) {
      besoinsMap.set(key, {
        especeId: culture.especeId,
        especeCouleur: culture.especeCouleur,
        varieteId: culture.varieteId,
        nbPlants: 0,
        semainePlantation: culture.semainePlantation,
        stockActuel: culture.varieteId ? (userStockMap.get(culture.varieteId)?.stockPlants || 0) : 0,
        aCommander: 0,
        cultures: [],
      })
    }

    const besoin = besoinsMap.get(key)!
    besoin.nbPlants += nbPlants
    besoin.cultures.push({
      plancheId: culture.plancheId,
      surface: Math.round(surfaceEffective * 10) / 10,
      nbPlants,
    })
  }

  // Calculer les plants a commander
  for (const besoin of besoinsMap.values()) {
    // Ajouter 10% de marge pour pertes
    const nbPlantsAvecMarge = Math.ceil(besoin.nbPlants * 1.1)
    besoin.aCommander = Math.max(0, nbPlantsAvecMarge - besoin.stockActuel)
  }

  return Array.from(besoinsMap.values()).sort((a, b) => a.especeId.localeCompare(b.especeId))
}

/**
 * Recupere les associations de cultures (planches voisines)
 */
export async function getAssociations(
  userId: string,
  annee: number
): Promise<AssociationCulture[]> {
  const culturesPrevues = await getCulturesPrevues(userId, annee)

  // Bug cmp8sbe6d (Marc 2026-05-16) — Avant : on lisait uniquement le champ
  // CSV `planchesInfluencees` qui n'est exposé nulle part dans l'UI, donc
  // 0/19 cultures avaient des voisins en permanence. On dérive désormais les
  // voisinages automatiquement à partir des positions géographiques :
  // deux planches sont voisines si leurs bounding boxes se touchent
  // (distance ≤ 2 m). Le champ CSV reste prioritaire s'il est renseigné.
  const planches = await prisma.planche.findMany({
    where: { userId },
    select: {
      id: true,
      nom: true,
      ilot: true,
      planchesInfluencees: true,
      posX: true,
      posY: true,
      largeur: true,
      longueur: true,
    },
  })
  const plancheMap = new Map(planches.map(p => [p.nom, p]))
  const cultureMap = new Map(culturesPrevues.map(c => [c.plancheId, c]))

  const SEUIL_VOISINAGE_M = 2

  function bbox(p: { posX: number | null; posY: number | null; largeur: number | null; longueur: number | null }) {
    if (p.posX == null || p.posY == null || p.largeur == null || p.longueur == null) return null
    return {
      x1: p.posX,
      y1: p.posY,
      x2: p.posX + (p.largeur ?? 0),
      y2: p.posY + (p.longueur ?? 0),
    }
  }
  function distanceBox(a: ReturnType<typeof bbox>, b: ReturnType<typeof bbox>): number {
    if (!a || !b) return Infinity
    const dx = Math.max(0, Math.max(a.x1, b.x1) - Math.min(a.x2, b.x2))
    const dy = Math.max(0, Math.max(a.y1, b.y1) - Math.min(a.y2, b.y2))
    return Math.sqrt(dx * dx + dy * dy)
  }

  function voisinsGeographiques(planche: typeof planches[number]): string[] {
    const a = bbox(planche)
    if (!a) return []
    const voisins: string[] = []
    for (const autre of planches) {
      if (autre.nom === planche.nom) continue
      const b = bbox(autre)
      if (!b) continue
      if (distanceBox(a, b) <= SEUIL_VOISINAGE_M) {
        const id = autre.nom ?? autre.id
        if (id) voisins.push(id)
      }
    }
    return voisins
  }

  const associations: AssociationCulture[] = []

  // Bug #6 — Précharger toutes les paires d'espèces présentes pour évaluer
  // les associations en un seul scan (vs lookup par paire qui multiplie les
  // requêtes). On collecte toutes les espèces uniques, puis on calcule la
  // table d'incompatibilité paire-à-paire.
  const allEspeceIds = new Set<string>()
  for (const c of culturesPrevues) {
    if (c.especeId) allEspeceIds.add(c.especeId)
  }
  const alertesAll = allEspeceIds.size >= 2
    ? await alertesAssociations(prisma, Array.from(allEspeceIds))
    : []

  // Map "especeA|especeB" → alerte la plus prioritaire (défavorable > favorable).
  const pairKey = (a: string, b: string) => {
    const [x, y] = [a.toLowerCase(), b.toLowerCase()].sort()
    return `${x}|${y}`
  }
  const alerteParPaire = new Map<string, { type: "favorable" | "defavorable"; message: string }>()
  for (const a of alertesAll) {
    const key = pairKey(a.especes[0], a.especes[1])
    const existing = alerteParPaire.get(key)
    // Conserver la défavorable si on a une collision (priorité au risque).
    if (!existing || (a.type === "defavorable" && existing.type !== "defavorable")) {
      alerteParPaire.set(key, { type: a.type, message: a.message })
    }
  }

  for (const culture of culturesPrevues) {
    const planche = plancheMap.get(culture.plancheId)
    if (!planche) continue

    const csv = planche.planchesInfluencees
      ? planche.planchesInfluencees.split(',').map(s => s.trim()).filter(Boolean)
      : []
    const planchesVoisines = csv.length > 0 ? csv : voisinsGeographiques(planche)

    const culturesVoisines = planchesVoisines
      .map(pvId => {
        const cv = cultureMap.get(pvId)
        if (!cv) return null
        let evalType: "favorable" | "defavorable" | "neutre" = "neutre"
        let evalMessage: string | null = null
        if (culture.especeId && cv.especeId) {
          const found = alerteParPaire.get(pairKey(culture.especeId, cv.especeId))
          if (found) {
            evalType = found.type
            evalMessage = found.message
          }
        }
        return { plancheId: pvId, especeId: cv.especeId, eval: evalType, evalMessage }
      })
      .filter((cv): cv is { plancheId: string; especeId: string | null; eval: "favorable" | "defavorable" | "neutre"; evalMessage: string | null } => cv !== null)

    const aDefavorable = culturesVoisines.some(cv => cv.eval === "defavorable")
    const aFavorable = culturesVoisines.some(cv => cv.eval === "favorable")
    const scoreAssociation: AssociationCulture["scoreAssociation"] =
      aDefavorable && aFavorable ? "mixte"
      : aDefavorable ? "defavorable"
      : aFavorable ? "favorable"
      : "neutre"

    associations.push({
      plancheId: culture.plancheId,
      ilot: culture.ilot,
      cultureEspeceId: culture.especeId,
      cultureSemaine: culture.semainePlantation || culture.semaineSemis,
      planchesVoisines,
      culturesVoisines,
      scoreAssociation,
    })
  }

  return associations
}

/**
 * Cree les cultures en batch a partir des cultures prevues
 */
export async function creerCulturesBatch(
  userId: string,
  cultures: { plancheId: string; itpId: string; annee: number; varieteId?: string }[]
): Promise<{ created: number; cultures: { id: number; plancheId: string; especeId: string }[] }> {
  const results: { id: number; plancheId: string; especeId: string }[] = []

  // Recuperer les ITPs pour avoir les infos necessaires
  const itpIds = [...new Set(cultures.map(c => c.itpId))]
  const itps = await prisma.iTP.findMany({
    where: { id: { in: itpIds } },
    include: { espece: true },
  })
  const itpMap = new Map(itps.map(itp => [itp.id, itp]))

  // Resolve planche noms to cuid IDs
  const plancheNoms = [...new Set(cultures.map(c => c.plancheId))]
  const planchesDb = await prisma.planche.findMany({
    where: { userId, nom: { in: plancheNoms } },
    select: { id: true, nom: true, largeur: true },
  })
  const plancheNomToId = new Map(planchesDb.map(p => [p.nom, p.id]))

  for (const culture of cultures) {
    const itp = itpMap.get(culture.itpId)
    if (!itp || !itp.especeId) continue

    // Resolve planche nom → cuid
    const plancheCuidId = plancheNomToId.get(culture.plancheId) || culture.plancheId

    // Verifier si la culture existe deja
    const existing = await prisma.culture.findFirst({
      where: {
        userId,
        plancheId: plancheCuidId,
        especeId: itp.especeId,
        annee: culture.annee,
      },
    })

    if (existing) continue

    // Calculer les dates a partir des semaines
    const annee = culture.annee
    const dateSemis = itp.semaineSemis
      ? calculerDateDepuisSemaine(annee, itp.semaineSemis)
      : null
    const datePlantation = itp.semainePlantation
      ? calculerDateDepuisSemaine(annee, itp.semainePlantation)
      : null
    const dateRecolte = itp.semaineRecolte
      ? calculerDateDepuisSemaine(annee, itp.semaineRecolte)
      : null

    // Creer la culture
    const newCulture = await prisma.culture.create({
      data: {
        userId,
        especeId: itp.especeId,
        varieteId: culture.varieteId || null,
        itpId: culture.itpId,
        plancheId: plancheCuidId,
        annee: culture.annee,
        dateSemis,
        datePlantation,
        dateRecolte,
        nbRangs: itp.nbRangs,
      },
    })

    // Décrément automatique du stock de semences (per-user)
    if (culture.varieteId && dateSemis) {
      try {
        const variete = await prisma.variete.findUnique({
          where: { id: culture.varieteId },
          select: { nbGrainesG: true },
        })

        const userStock = await prisma.userStockVariete.findFirst({
          where: { userId, varieteId: culture.varieteId },
        })

        const currentStock = userStock?.stockGraines || 0

        const planche = await prisma.planche.findUnique({
          where: { id: plancheCuidId },
          select: { largeur: true },
        })

        if (variete && currentStock > 0 && variete.nbGrainesG && planche && planche.largeur) {
          const longueur = newCulture.longueur || 0
          const nbRangs = newCulture.nbRangs || 1
          const espacement = newCulture.espacement || 0

          let grammesNecessaires = 0

          if (espacement > 0 && variete.nbGrainesG > 0) {
            // Semis en ligne
            const nbGrainesPlant = itp.nbGrainesPlant || 1
            grammesNecessaires = Math.ceil(
              (longueur * nbRangs / espacement * 100 * nbGrainesPlant) /
              variete.nbGrainesG
            )
          } else if (itp.doseSemis && planche.largeur > 0) {
            // Semis à la volée
            grammesNecessaires = Math.ceil(longueur * planche.largeur * itp.doseSemis)
          }

          if (grammesNecessaires > 0) {
            await prisma.userStockVariete.upsert({
              where: { userId_varieteId: { userId, varieteId: culture.varieteId } },
              create: {
                userId,
                varieteId: culture.varieteId,
                stockGraines: Math.max(0, -grammesNecessaires),
                dateStock: new Date(),
              },
              update: {
                stockGraines: Math.max(0, currentStock - grammesNecessaires),
                dateStock: new Date(),
              },
            })
          }
        }
      } catch (stockError) {
        console.warn('Erreur décrément stock (culture batch):', stockError)
        // Ne pas bloquer la création
      }
    }

    results.push({
      id: newCulture.id,
      plancheId: culture.plancheId, // Keep nom for display
      especeId: itp.especeId,
    })
  }

  return {
    created: results.length,
    cultures: results,
  }
}

/**
 * Statistiques de planification
 */
export async function getStatsPlanification(userId: string, annee: number) {
  const culturesPrevues = await getCulturesPrevues(userId, annee)
  const recoltesPrevues = await getRecoltesPrevues(userId, annee, 'mois')

  const totalCultures = culturesPrevues.length
  const culturesExistantes = culturesPrevues.filter(c => c.existante).length
  const culturesACreer = totalCultures - culturesExistantes
  const surfaceTotale = culturesPrevues.reduce((sum, c) => sum + c.surface, 0)
  const recoltesTotales = recoltesPrevues.reduce((sum, r) => sum + r.totalKg, 0)

  // Especes uniques (projection rotation/ITP)
  const especesUniques = new Set(culturesPrevues.map(c => c.especeId).filter(Boolean))

  // BUG-14 — Variétés réellement planifiées : on compte les variétés
  // distinctes des `Culture` créées en base pour l'année (pas les
  // détails de rotation, qui multiplient × N le compteur). On filtre
  // aussi les variétés null (cultures pour lesquelles le maraîcher n'a
  // pas encore choisi une variété précise).
  const cultureRows = await prisma.culture.findMany({
    where: { userId, annee, varieteId: { not: null } },
    select: { varieteId: true, especeId: true },
    distinct: ['varieteId'],
  })
  const nbVarietes = cultureRows.length
  const especesAvecVariete = new Set(cultureRows.map(c => c.especeId).filter(Boolean))

  return {
    totalCultures,
    culturesExistantes,
    culturesACreer,
    surfaceTotale: Math.round(surfaceTotale * 100) / 100,
    recoltesTotales: Math.round(recoltesTotales * 100) / 100,
    nbEspeces: especesUniques.size,
    nbVarietes,
    nbEspecesAvecVariete: especesAvecVariete.size,
  }
}
