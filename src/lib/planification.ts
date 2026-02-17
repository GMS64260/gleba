/**
 * Bibliotheque de calcul pour la planification des cultures
 * Logique metier basee sur potaleger_old
 */

import prisma from '@/lib/prisma'
import { calculerDateDepuisSemaine } from './assistant-helpers'

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
  grainesNecessaires: number // g
  stockActuel: number
  nbGrainesG: number | null
  aCommander: number
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
  }[]
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

const MOIS_NOMS = [
  'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre'
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
            ilot: planche.ilot,
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

  // Ajouter les cultures directes qui ne sont pas déjà dans les prévues (via rotation)
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
        ilot: culture.planche.ilot,
        rotationId: culture.planche.rotationId,
        rotationAnnee: 0, // Pas de rotation
        itpId: culture.itpId,
        especeId: culture.especeId,
        especeCouleur: culture.espece?.couleur || null,
        varieteId: culture.varieteId,
        annee: culture.annee || annee,
        semaineSemis: culture.itp?.semaineSemis || null,
        semainePlantation: culture.itp?.semainePlantation || null,
        semaineRecolte: culture.itp?.semaineRecolte || null,
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
      periode: groupBy === 'mois' ? MOIS_NOMS[i - 1] : `S${i}`,
      periodeNum: i,
      especes: especesArray,
      totalKg: especesArray.reduce((sum, e) => sum + e.quantite, 0),
      totalSurface: especesArray.reduce((sum, e) => sum + e.surface, 0),
    })
  }

  return result
}

/**
 * Calcule les besoins en semences pour une annee
 */
export async function getBesoinsSemences(
  userId: string,
  annee: number
): Promise<BesoinSemence[]> {
  const culturesPrevues = await getCulturesPrevues(userId, annee)

  // Grouper par espece/variete
  const besoinsMap = new Map<string, BesoinSemence>()

  // Recuperer les infos des varietes pour nbGrainesG
  const varietes = await prisma.variete.findMany({
    select: { id: true, especeId: true, nbGrainesG: true },
  })
  const varieteMap = new Map(varietes.map(v => [v.id, v]))

  // Recuperer les stocks par utilisateur
  const userStocks = await prisma.userStockVariete.findMany({
    where: { userId },
    select: { varieteId: true, stockGraines: true, stockPlants: true },
  })
  const userStockMap = new Map(userStocks.map(us => [us.varieteId, us]))

  for (const culture of culturesPrevues) {
    if (!culture.especeId) continue

    const key = `${culture.especeId}|${culture.varieteId || ''}`
    const nbPlants = calculerNbPlants(
      culture.plancheLongueur,
      culture.plancheLargeur,
      culture.nbRangs,
      culture.espacement
    )

    if (!besoinsMap.has(key)) {
      const variete = culture.varieteId ? varieteMap.get(culture.varieteId) : null

      besoinsMap.set(key, {
        especeId: culture.especeId,
        especeCouleur: culture.especeCouleur,
        varieteId: culture.varieteId,
        surfaceTotale: 0,
        nbPlants: 0,
        grainesNecessaires: 0,
        stockActuel: culture.varieteId ? (userStockMap.get(culture.varieteId)?.stockGraines || 0) : 0,
        nbGrainesG: variete?.nbGrainesG || null,
        aCommander: 0,
      })
    }

    const besoin = besoinsMap.get(key)!
    besoin.surfaceTotale += culture.surface
    besoin.nbPlants += nbPlants
  }

  // Calculer les graines necessaires
  for (const besoin of besoinsMap.values()) {
    if (besoin.nbGrainesG && besoin.nbGrainesG > 0) {
      // Ajouter 20% de marge pour pertes
      besoin.grainesNecessaires = Math.ceil((besoin.nbPlants * 1.2) / besoin.nbGrainesG)
    }
    besoin.aCommander = Math.max(0, besoin.grainesNecessaires - besoin.stockActuel)
  }

  return Array.from(besoinsMap.values()).sort((a, b) => a.especeId.localeCompare(b.especeId))
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
    const nbPlants = calculerNbPlants(
      culture.plancheLongueur,
      culture.plancheLargeur,
      culture.nbRangs,
      culture.espacement
    )

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
      surface: culture.surface,
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

  // Recuperer les planches avec leurs influences
  const planches = await prisma.planche.findMany({
    where: { userId },
    select: { id: true, nom: true, ilot: true, planchesInfluencees: true },
  })
  const plancheMap = new Map(planches.map(p => [p.nom, p]))
  const cultureMap = new Map(culturesPrevues.map(c => [c.plancheId, c]))

  const associations: AssociationCulture[] = []

  for (const culture of culturesPrevues) {
    const planche = plancheMap.get(culture.plancheId)
    if (!planche) continue

    // Parser les planches influencees (CSV)
    const planchesVoisines = planche.planchesInfluencees
      ? planche.planchesInfluencees.split(',').map(s => s.trim()).filter(Boolean)
      : []

    // Trouver les cultures sur les planches voisines
    const culturesVoisines = planchesVoisines
      .map(pvId => {
        const cv = cultureMap.get(pvId)
        return cv ? { plancheId: pvId, especeId: cv.especeId } : null
      })
      .filter((cv): cv is { plancheId: string; especeId: string | null } => cv !== null)

    associations.push({
      plancheId: culture.plancheId,
      ilot: culture.ilot,
      cultureEspeceId: culture.especeId,
      cultureSemaine: culture.semainePlantation || culture.semaineSemis,
      planchesVoisines,
      culturesVoisines,
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

  // Especes uniques
  const especesUniques = new Set(culturesPrevues.map(c => c.especeId).filter(Boolean))

  return {
    totalCultures,
    culturesExistantes,
    culturesACreer,
    surfaceTotale: Math.round(surfaceTotale * 100) / 100,
    recoltesTotales: Math.round(recoltesTotales * 100) / 100,
    nbEspeces: especesUniques.size,
  }
}
