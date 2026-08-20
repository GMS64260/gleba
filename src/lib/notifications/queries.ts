/**
 * Couche DONNÉES du système de notifications.
 *
 * Réutilise volontairement les fonctions existantes plutôt que de les
 * dupliquer : fetchOpenMeteoForecast / fetchOpenMeteoHistory (lib/meteo),
 * grouperIrrigationsPlanifieesParPlancheEtJour (lib/irrigation-planche),
 * alertesAssociations (lib/associations-alertes).
 */

import prisma from "@/lib/prisma"
import { fetchOpenMeteoForecast, fetchOpenMeteoHistory } from "@/lib/meteo"
import { grouperIrrigationsPlanifieesParPlancheEtJour } from "@/lib/irrigation-planche"
import { borneLectureIrrigation, idsAExpirer } from "@/lib/irrigation-peremption"
import { alertesAssociations } from "@/lib/associations-alertes"
import { zoneEffectiveUser } from "@/lib/terroir"
import type { ZoneClimat } from "@/lib/terroir"
import { itpApplicableAZone } from "@/lib/calendrier-climat"
import {
  calculerRappelsIrrigationsEnRetard,
  calculerRecoltesMures,
  coordKey,
  dateLocaleIso,
  debutDeJournee,
  deciderIrrigationInutile,
  detecterAlertesMeteo,
  detecterStocksAlimentsBas,
  detecterStocksFertilisantsBas,
  detecterStocksVarietesBas,
  finDeJournee,
  formatDateFr,
  formaterStockBas,
  fusionnerStocksBas,
} from "./detect"
import { semaineCourante, tachesItpSemainePourCultures } from "./itp-semaine"
import { visibiliteReferentiel } from "@/lib/referentiel-communaute"
import type { CultureItpInput, ItpSemaineInput } from "./itp-semaine"
import type {
  AlerteMeteoNotification,
  AlerteUrgente,
  DestinataireNotification,
  TacheItpSemaine,
  TacheJour,
} from "./types"
import type {
  StockAlimentInput,
  StockBasDetecte,
  StockFertilisantInput,
  StockVarieteInput,
} from "./detect"
import { DEFAULT_NOTIF_PREFS, parseNotifPrefs, type NotifPrefs } from "./prefs"

// ─────────────────────────────────────────────────────────────────────────────
// Destinataires
// ─────────────────────────────────────────────────────────────────────────────

const EMAIL_VALIDE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Tous les users actifs ayant un email valide — par défaut activés pour les
 * notifications métier. `emailOptOut` (désabonnement existant de Gleba pour
 * les emails non transactionnels) est respecté.
 */
export async function getDestinatairesNotifications(): Promise<DestinataireNotification[]> {
  const users = await prisma.user.findMany({
    where: { active: true, emailOptOut: false },
    select: { id: true, email: true, name: true },
  })
  return users
    .filter((user) => user.email && EMAIL_VALIDE.test(user.email))
    .map((user) => ({ id: user.id, email: user.email as string, name: user.name }))
}

/** Charge les préférences de notifications d'un utilisateur. */
export async function chargerPrefsNotif(userId: string): Promise<NotifPrefs> {
  const preference = await prisma.userPreference.findUnique({
    where: { userId_key: { userId, key: "notifPrefs" } },
    select: { value: true },
  })
  if (!preference) return { ...DEFAULT_NOTIF_PREFS }

  try {
    return parseNotifPrefs(JSON.parse(preference.value))
  } catch {
    return { ...DEFAULT_NOTIF_PREFS }
  }
}

/** Coordonnées (lat/lng) dédupliquées des parcelles géoréférencées. */
export async function getCoordsUtilisateur(
  userId: string
): Promise<Array<{ lat: number; lng: number }>> {
  const parcelles = await prisma.parcelleGeo.findMany({
    where: { userId, centroidLat: { not: null }, centroidLng: { not: null } },
    select: { centroidLat: true, centroidLng: true },
  })
  const vus = new Set<string>()
  const coords: Array<{ lat: number; lng: number }> = []
  for (const parcelle of parcelles) {
    const lat = parcelle.centroidLat
    const lng = parcelle.centroidLng
    if (lat === null || lng === null) continue
    const cle = `${Math.round(lat * 100)}_${Math.round(lng * 100)}`
    if (vus.has(cle)) continue
    vus.add(cle)
    coords.push({ lat, lng })
  }
  return coords
}

// ─────────────────────────────────────────────────────────────────────────────
// Stocks bas — données par utilisateur + détection
// ─────────────────────────────────────────────────────────────────────────────

export interface StocksPourDetection {
  varietes: StockVarieteInput[]
  fertilisants: StockFertilisantInput[]
  aliments: StockAlimentInput[]
}

/** Charge les stocks utilisateur nécessaires à la détection des seuils bas. */
export async function fetchStocksPourDetection(userId: string): Promise<StocksPourDetection> {
  const [varietes, fertilisants, aliments] = await Promise.all([
    prisma.userStockVariete.findMany({
      where: { userId },
      select: {
        id: true,
        varieteId: true,
        stockGraines: true,
        stockPlants: true,
        stockMinGraines: true,
        stockMinPlants: true,
        uniteStock: true,
        variete: { select: { nom: true } },
      },
    }),
    prisma.userStockFertilisant.findMany({
      where: { userId },
      select: {
        id: true,
        fertilisantId: true,
        stock: true,
        stockMin: true,
      },
    }),
    prisma.userStockAliment.findMany({
      where: { userId },
      select: {
        id: true,
        alimentId: true,
        stock: true,
        stockMin: true,
        aliment: { select: { nom: true } },
      },
    }),
  ])

  return {
    varietes: varietes.map((stock) => ({
      id: stock.id,
      varieteId: stock.varieteId,
      varieteNom: stock.variete.nom ?? stock.varieteId,
      stockGraines: stock.stockGraines,
      stockPlants: stock.stockPlants,
      stockMinGraines: stock.stockMinGraines,
      stockMinPlants: stock.stockMinPlants,
      uniteStock: stock.uniteStock,
    })),
    fertilisants: fertilisants.map((stock) => ({
      id: stock.id,
      fertilisantId: stock.fertilisantId,
      // Le référentiel Fertilisant n'a pas de champ nom : l'identifiant est
      // actuellement le seul libellé stable disponible.
      fertilisantNom: stock.fertilisantId,
      stock: stock.stock,
      stockMin: stock.stockMin,
    })),
    aliments: aliments.map((stock) => ({
      id: stock.id,
      alimentId: stock.alimentId,
      alimentNom: stock.aliment.nom,
      stock: stock.stock,
      stockMin: stock.stockMin,
    })),
  }
}

/** Retourne les stocks sous seuil, tous types confondus et triés par criticité. */
export async function chargerStocksBas(userId: string): Promise<StockBasDetecte[]> {
  const stocks = await fetchStocksPourDetection(userId)
  return fusionnerStocksBas(
    detecterStocksVarietesBas(stocks.varietes),
    detecterStocksFertilisantsBas(stocks.fertilisants),
    detecterStocksAlimentsBas(stocks.aliments)
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Météo — agrégat prévisions + pluie récente (même approche que /api/calendrier)
// ─────────────────────────────────────────────────────────────────────────────

export interface MeteoParCoord {
  precipParCoordEtJour: Map<string, Map<string, number>>
  pluieRecente3jParCoord: Map<string, number>
}

/** Précipitations prévues par jour + pluie cumulée sur 3 j, par coordonnée. */
export async function fetchMeteoParCoord(
  coords: Array<{ lat: number; lng: number }>
): Promise<MeteoParCoord> {
  const precipParCoordEtJour = new Map<string, Map<string, number>>()
  const pluieRecente3jParCoord = new Map<string, number>()

  await Promise.all(
    coords.map(async ({ lat, lng }) => {
      const cle = coordKey(lat, lng)
      try {
        const forecast = await fetchOpenMeteoForecast(lat, lng)
        const parJour = new Map<string, number>()
        for (const jour of forecast.daily) parJour.set(jour.date, jour.precipitation)
        precipParCoordEtJour.set(cle, parJour)

        const today = new Date()
        const j3 = new Date(today)
        j3.setDate(j3.getDate() - 3)
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        const historique = await fetchOpenMeteoHistory(
          lat,
          lng,
          j3.toISOString().split("T")[0],
          yesterday.toISOString().split("T")[0]
        )
        const pluieHisto = historique.reduce((somme, jour) => somme + jour.precipitation, 0)
        const pluieAujourdhui = forecast.daily[0]?.precipitation ?? 0
        pluieRecente3jParCoord.set(cle, pluieHisto + pluieAujourdhui)
      } catch (error) {
        // Une coordonnée en erreur ne doit pas faire échouer le scan entier
        console.warn(`[notifications] Météo indisponible pour ${cle}:`, error)
      }
    })
  )

  return { precipParCoordEtJour, pluieRecente3jParCoord }
}

/** Alertes météo notifiables du jour (horizon 24 h) pour un utilisateur. */
export async function recupererAlertesMeteoJour(userId: string): Promise<AlerteMeteoNotification[]> {
  const coords = await getCoordsUtilisateur(userId)
  if (coords.length === 0) return []

  const alertes: AlerteMeteoNotification[] = []
  for (const { lat, lng } of coords) {
    try {
      const { current, daily } = await fetchOpenMeteoForecast(lat, lng)
      alertes.push(...detecterAlertesMeteo(daily, current, { horizonJours: 1 }))
    } catch (error) {
      console.warn(`[notifications] Prévisions indisponibles pour ${coordKey(lat, lng)}:`, error)
    }
  }
  return alertes
}

// ─────────────────────────────────────────────────────────────────────────────
// Résumé quotidien — tâches du jour
// ─────────────────────────────────────────────────────────────────────────────

const CULTURE_SELECT = {
  id: true,
  especeId: true,
  varieteId: true,
  dateSemis: true,
  datePlantation: true,
  dateRecolte: true,
  semisFait: true,
  plantationFaite: true,
  recolteFaite: true,
  espece: { select: { couleur: true, nom: true } },
  variete: { select: { nom: true } },
  planche: { select: { nom: true, ilot: true, parcelleGeo: { select: { centroidLat: true, centroidLng: true } } } },
  itp: { select: { dureeCulture: true } },
} as const

interface CultureAvecPlanche {
  id: number
  especeId: string
  varieteId: string | null
  semisFait: boolean
  plantationFaite: boolean
  recolteFaite: boolean
  espece: { couleur: string | null; nom: string | null } | null
  variete: { nom: string | null } | null
  planche: { nom: string | null; ilot: string | null } | null
  itp: { dureeCulture: number | null } | null
}

function cultureVersTache(
  culture: CultureAvecPlanche,
  type: "semis" | "plantation" | "recolte",
  date: Date
): TacheJour {
  const fait = type === "semis" ? culture.semisFait : type === "plantation" ? culture.plantationFaite : culture.recolteFaite
  return {
    id: culture.id,
    type,
    especeNom: culture.espece?.nom ?? culture.especeId,
    varieteNom: culture.variete?.nom ?? culture.varieteId ?? null,
    plancheName: culture.planche?.nom ?? null,
    ilot: culture.planche?.ilot ?? null,
    date: date.toISOString(),
    fait,
    couleur: culture.espece?.couleur ?? null,
  }
}

/**
 * Tâches planifiées aujourd'hui (semis, plantations, récoltes, irrigations
 * regroupées par planche/jour via la fonction existante). Inclut la météo
 * d'irrigation (pluie prévue, passage probablement inutile).
 */
export async function chargerTachesDuJour(userId: string): Promise<TacheJour[]> {
  const start = debutDeJournee()
  const end = finDeJournee()

  const [semis, plantations, recoltes, culturesMures, irrigations, coords] = await Promise.all([
    prisma.culture.findMany({
      where: { userId, dateSemis: { gte: start, lte: end } },
      select: CULTURE_SELECT,
    }),
    prisma.culture.findMany({
      where: { userId, datePlantation: { gte: start, lte: end } },
      select: CULTURE_SELECT,
    }),
    prisma.culture.findMany({
      where: { userId, dateRecolte: { gte: start, lte: end } },
      select: CULTURE_SELECT,
    }),
    // Récoltes mûres du jour : cultures sans dateRecolte planifiée dont la
    // maturité calculée (semis/plantation + durée culture ITP) tombe aujourd'hui
    // ou date de quelques jours (rappel quotidien jusqu'à récolte).
    prisma.culture.findMany({
      where: {
        userId,
        recolteFaite: false,
        terminee: null,
        dateRecolte: null,
        OR: [{ dateSemis: { not: null } }, { datePlantation: { not: null } }],
      },
      select: CULTURE_SELECT,
    }),
    prisma.irrigationPlanifiee.findMany({
      // `perimee: false` — un arrosage manqué depuis plus d'un cycle est
      // ABANDONNÉ (cf. irrigation-peremption) : il ne compte plus à l'écran, il
      // ne doit pas non plus arriver par courriel. Les trois requêtes
      // d'irrigation de ce module l'omettaient (2026-08-20).
      where: { userId, perimee: false, datePrevue: { gte: start, lte: end } },
      include: {
        culture: {
          select: {
            id: true,
            especeId: true,
            varieteId: true,
            espece: { select: { couleur: true, nom: true } },
            variete: { select: { nom: true } },
            planche: {
              select: {
                nom: true,
                ilot: true,
                parcelleGeo: { select: { centroidLat: true, centroidLng: true } },
              },
            },
          },
        },
      },
    }),
    getCoordsUtilisateur(userId),
  ])

  const taches: TacheJour[] = [
    ...semis.map((c) => cultureVersTache(c as CultureAvecPlanche, "semis", c.dateSemis as Date)),
    ...plantations.map((c) =>
      cultureVersTache(c as CultureAvecPlanche, "plantation", c.datePlantation as Date)
    ),
    ...recoltes.map((c) => cultureVersTache(c as CultureAvecPlanche, "recolte", c.dateRecolte as Date)),
  ]

  // Récoltes mûres du jour (maturité calculée, sans dateRecolte planifiée).
  const muresJour = calculerRecoltesMures(
    culturesMures.map((c) => ({
      id: c.id,
      dateSemis: c.dateSemis,
      datePlantation: c.datePlantation,
      recolteFaite: c.recolteFaite,
      dureeCultureJours: c.itp?.dureeCulture ?? null,
      especeNom: c.espece?.nom ?? c.especeId,
      plancheNom: c.planche?.nom ?? null,
    })),
    new Date(),
    // Fenêtre résumé : mûre aujourd'hui ou depuis 3 j max (rappel, pas de spam).
    { avanceJours: 0, depassementJours: 3 }
  )
  for (const recolte of muresJour) {
    taches.push({
      id: recolte.cultureId,
      type: "recolte",
      especeNom: recolte.especeNom,
      varieteNom: null,
      plancheName: recolte.plancheNom ?? null,
      ilot: null,
      date: start.toISOString(),
      fait: false,
      couleur: null,
    })
  }

  if (irrigations.length === 0) return taches

  const meteo = await fetchMeteoParCoord(coords)
  const fallback = coords[0]

  const mappees = irrigations.map((irrigation) => {
    const parcelle = irrigation.culture.planche?.parcelleGeo
    const lat = parcelle?.centroidLat ?? fallback?.lat
    const lng = parcelle?.centroidLng ?? fallback?.lng
    let pluiePrevue: number | null = null
    let probablementInutile = false
    if (lat !== undefined && lng !== undefined) {
      const dateStr = irrigation.datePrevue.toISOString().split("T")[0]
      pluiePrevue = meteo.precipParCoordEtJour.get(coordKey(lat, lng))?.get(dateStr) ?? null
      const pluieRecente = meteo.pluieRecente3jParCoord.get(coordKey(lat, lng)) ?? 0
      const joursAvant = Math.floor((irrigation.datePrevue.getTime() - Date.now()) / 86_400_000)
      probablementInutile = deciderIrrigationInutile({ pluiePrevue, pluieRecente3j: pluieRecente, joursAvant })
    }
    return {
      id: irrigation.id,
      type: "irrigation" as const,
      especeId: irrigation.culture.especeId,
      varieteId: irrigation.culture.varieteId || null,
      plancheId: irrigation.culture.planche?.nom || null,
      plancheName: irrigation.culture.planche?.nom || null,
      ilot: irrigation.culture.planche?.ilot || null,
      datePrevue: irrigation.datePrevue.toISOString(),
      date: irrigation.datePrevue.toISOString(),
      fait: irrigation.fait,
      couleur: irrigation.culture.espece?.couleur || null,
      especeNom: irrigation.culture.espece?.nom ?? irrigation.culture.especeId,
      varieteNom: irrigation.culture.variete?.nom ?? irrigation.culture.varieteId ?? null,
      cultureId: irrigation.culture.id,
      retardJours: 0,
      pluiePrevue: pluiePrevue !== null ? Math.round(pluiePrevue * 10) / 10 : null,
      probablementInutile,
    }
  })

  const groupes = grouperIrrigationsPlanifieesParPlancheEtJour(mappees)
  for (const groupe of groupes) {
    taches.push({
      id: groupe.irrigationIds[0],
      type: "irrigation",
      especeNom: groupe.especeNom ?? "Irrigation",
      varieteNom: null,
      plancheName: groupe.plancheName ?? null,
      ilot: groupe.ilot ?? null,
      date: groupe.datePrevue,
      fait: groupe.fait,
      couleur: groupe.couleur ?? null,
      pluiePrevue: groupe.pluiePrevue,
      probablementInutile: groupe.probablementInutile,
    })
  }

  return taches
}

// ─────────────────────────────────────────────────────────────────────────────
// Alertes urgentes (temps réel)
// ─────────────────────────────────────────────────────────────────────────────

const RATIO_STOCK_CRITIQUE = 0.5

/** Stocks à moins de la moitié du seuil minimum. */
async function detecterStocksCritiques(userId: string): Promise<AlerteUrgente[]> {
  const stocks = await chargerStocksBas(userId)
  return stocks
    .filter((stock) => stock.ratio < RATIO_STOCK_CRITIQUE)
    .map((stock) => ({
      type: "stock-bas" as const,
      titre: `stock critique : ${stock.nom}`,
      message: `${formaterStockBas(stock)}. Réapprovisionnement recommandé.`,
      key: stock.key,
    }))
}

/** Irrigation(s) du jour probablement inutiles (pluie récente/prévue). */
async function detecterIrrigationsInutiles(userId: string): Promise<AlerteUrgente[]> {
  const start = debutDeJournee()
  const end = finDeJournee()
  const [irrigations, coords] = await Promise.all([
    prisma.irrigationPlanifiee.findMany({
      where: { userId, fait: false, perimee: false, datePrevue: { gte: start, lte: end } },
      include: {
        culture: {
          select: {
            id: true,
            especeId: true,
            varieteId: true,
            espece: { select: { nom: true } },
            variete: { select: { nom: true } },
            planche: {
              select: {
                nom: true,
                ilot: true,
                parcelleGeo: { select: { centroidLat: true, centroidLng: true } },
              },
            },
          },
        },
      },
    }),
    getCoordsUtilisateur(userId),
  ])
  if (irrigations.length === 0) return []

  const meteo = await fetchMeteoParCoord(coords)
  const fallback = coords[0]

  const mappees = irrigations.map((irrigation) => {
    const parcelle = irrigation.culture.planche?.parcelleGeo
    const lat = parcelle?.centroidLat ?? fallback?.lat
    const lng = parcelle?.centroidLng ?? fallback?.lng
    let pluiePrevue: number | null = null
    let probablementInutile = false
    if (lat !== undefined && lng !== undefined) {
      const dateStr = irrigation.datePrevue.toISOString().split("T")[0]
      pluiePrevue = meteo.precipParCoordEtJour.get(coordKey(lat, lng))?.get(dateStr) ?? null
      const pluieRecente = meteo.pluieRecente3jParCoord.get(coordKey(lat, lng)) ?? 0
      const joursAvant = Math.floor((irrigation.datePrevue.getTime() - Date.now()) / 86_400_000)
      probablementInutile = deciderIrrigationInutile({ pluiePrevue, pluieRecente3j: pluieRecente, joursAvant })
    }
    return {
      id: irrigation.id,
      type: "irrigation" as const,
      especeId: irrigation.culture.especeId,
      varieteId: irrigation.culture.varieteId || null,
      plancheId: irrigation.culture.planche?.nom || null,
      plancheName: irrigation.culture.planche?.nom || null,
      ilot: irrigation.culture.planche?.ilot || null,
      datePrevue: irrigation.datePrevue.toISOString(),
      date: irrigation.datePrevue.toISOString(),
      fait: irrigation.fait,
      couleur: null,
      especeNom: irrigation.culture.espece?.nom ?? irrigation.culture.especeId,
      varieteNom: irrigation.culture.variete?.nom ?? irrigation.culture.varieteId ?? null,
      cultureId: irrigation.culture.id,
      retardJours: 0,
      pluiePrevue: pluiePrevue !== null ? Math.round(pluiePrevue * 10) / 10 : null,
      probablementInutile,
    }
  })

  const groupes = grouperIrrigationsPlanifieesParPlancheEtJour(mappees)
  const urgentes: AlerteUrgente[] = []
  const dateStr = dateLocaleIso()
  for (const groupe of groupes) {
    if (!groupe.probablementInutile) continue
    const planche = groupe.plancheName ?? "sans planche"
    urgentes.push({
      type: "irrigation-inutile",
      titre: `irrigation planche ${planche}`,
      message: groupe.especeNom
        ? `L'irrigation prévue aujourd'hui pour « ${groupe.especeNom} » (planche ${planche}) est probablement inutile : ${
            groupe.pluiePrevue != null && groupe.pluiePrevue >= 5
              ? `${groupe.pluiePrevue} mm de pluie sont prévus.`
              : "les précipitations récentes couvrent le besoin en eau."
          }`
        : `Irrigation planche ${planche} probablement inutile : pluie suffisante.`,
      key: `irrigation-inutile:${groupe.plancheId ?? groupe.cultureIds[0]}:${dateStr}`,
    })
  }
  return urgentes
}

/** Irrigations échues non faites, hors passages probablement couverts par la pluie. */
async function detecterIrrigationsEnRetard(userId: string): Promise<AlerteUrgente[]> {
  const [irrigations, coords] = await Promise.all([
    prisma.irrigationPlanifiee.findMany({
      // Sans borne basse, cette lecture remontait TOUT l'historique des passages
      // manqués : un compte à un millier de passages abandonnés recevait quinze
      // courriels de rappel (le plafond anti-spam), pour des arrosages
      // abandonnés depuis des semaines. La borne est celle de l'écran et du
      // briefing — au-delà d'un cycle complet, un passage n'est plus dû.
      where: {
        userId,
        fait: false,
        perimee: false,
        datePrevue: { gte: borneLectureIrrigation(new Date(), new Date(0)), lte: finDeJournee() },
      },
      orderBy: { datePrevue: "asc" },
      include: {
        culture: {
          select: {
            especeId: true,
            varieteId: true,
            espece: { select: { nom: true, besoinEau: true } },
            variete: { select: { nom: true } },
            planche: {
              select: {
                nom: true,
                parcelleGeo: { select: { centroidLat: true, centroidLng: true } },
              },
            },
          },
        },
      },
    }),
    getCoordsUtilisateur(userId),
  ])
  if (irrigations.length === 0) return []

  // La colonne `perimee` n'est qu'une TRACE : la règle se rejoue en mémoire à
  // chaque lecture (même invariant que l'écran et l'assistant, « 11 = 11 »).
  // Un passage périmé mais pas encore estampillé serait sinon notifié.
  const perimees = new Set(idsAExpirer(irrigations))
  const dues = irrigations.filter((irrigation) => !perimees.has(irrigation.id))
  if (dues.length === 0) return []

  const meteo = await fetchMeteoParCoord(coords)
  const fallback = coords[0]
  return calculerRappelsIrrigationsEnRetard(
    dues.map((irrigation) => ({
      id: irrigation.id,
      fait: irrigation.fait,
      datePrevue: irrigation.datePrevue,
      especeNom: irrigation.culture.espece?.nom ?? irrigation.culture.especeId,
      varieteNom: irrigation.culture.variete?.nom ?? irrigation.culture.varieteId ?? null,
      plancheNom: irrigation.culture.planche?.nom ?? null,
      lat: irrigation.culture.planche?.parcelleGeo?.centroidLat ?? null,
      lng: irrigation.culture.planche?.parcelleGeo?.centroidLng ?? null,
    })),
    meteo,
    { fallbackCoord: fallback }
  )
}

/** Associations défavorables (incompatibles) sur les planches actives. */
async function detecterAssociationsIncompatibles(userId: string): Promise<AlerteUrgente[]> {
  const planches = await prisma.planche.findMany({
    where: { userId },
    select: {
      id: true,
      nom: true,
      cultures: {
        // Cultures « en place » : pas encore récoltées, cycle non terminé.
        where: { recolteFaite: false, terminee: null },
        select: { especeId: true },
      },
    },
  })

  const urgentes: AlerteUrgente[] = []
  for (const planche of planches) {
    const especesIds = planche.cultures.map((c) => c.especeId).filter(Boolean) as string[]
    if (especesIds.length < 2) continue
    let alertes
    try {
      alertes = await alertesAssociations(prisma, especesIds)
    } catch (error) {
      console.warn(`[notifications] alertesAssociations planche ${planche.id} en échec:`, error)
      continue
    }
    for (const alerte of alertes) {
      if (alerte.type !== "defavorable") continue
      const [a, b] = alerte.especes
      urgentes.push({
        type: "association-incompatible",
        titre: `association incompatible planche ${planche.nom}`,
        message: alerte.message,
        key: `association-incompatible:${planche.id}:${[a, b].sort().join("-")}`,
      })
    }
  }
  return urgentes
}

/** Tâches (semis/plantation/récolte) dont l'échéance est dépassée et non faites. */
async function detecterTachesEnRetard(userId: string): Promise<AlerteUrgente[]> {
  const start = debutDeJournee()
  const cultures = await prisma.culture.findMany({
    where: {
      userId,
      semisFait: false,
      plantationFaite: false,
      recolteFaite: false,
      terminee: null,
      OR: [
        { dateSemis: { not: null, lt: start } },
        { datePlantation: { not: null, lt: start } },
        { dateRecolte: { not: null, lt: start } },
      ],
    },
    select: {
      id: true,
      especeId: true,
      dateSemis: true,
      datePlantation: true,
      dateRecolte: true,
      espece: { select: { nom: true } },
      planche: { select: { nom: true } },
    },
  })

  const urgentes: AlerteUrgente[] = []
  for (const culture of cultures) {
    const actions: Array<{ kind: "semis" | "plantation" | "recolte"; date: Date }> = []
    if (culture.dateSemis) actions.push({ kind: "semis", date: culture.dateSemis })
    if (culture.datePlantation) actions.push({ kind: "plantation", date: culture.datePlantation })
    if (culture.dateRecolte) actions.push({ kind: "recolte", date: culture.dateRecolte })
    const enRetard = actions.filter((a) => a.date < start).sort((a, b) => a.date.getTime() - b.date.getTime())
    if (enRetard.length === 0) continue

    const { kind, date } = enRetard[0]
    const jours = Math.max(1, Math.floor((start.getTime() - date.getTime()) / 86_400_000))
    const especeNom = culture.espece?.nom ?? culture.especeId
    const planche = culture.planche?.nom
    urgentes.push({
      type: "tache-retard",
      titre: `${kind} en retard de ${jours} jour${jours > 1 ? "s" : ""}`,
      message: `${kind[0].toUpperCase()}${kind.slice(1)} « ${especeNom} »${
        planche ? ` (planche ${planche})` : ""
      } prévu le ${formatDateFr(date.toISOString().split("T")[0])} et toujours non fait.`,
      key: `tache-retard:${kind}:${culture.id}`,
    })
  }
  return urgentes
}

/**
 * Cultures dont la maturité CALCULÉE (date semis/plantation + durée culture
 * de l'ITP) est atteinte ou imminente et pas encore récoltées (issue #16).
 * Uniquement les cultures SANS dateRecolte planifiée : celles qui en ont une
 * sont déjà couvertes par le calendrier (tâches du jour) et l'alerte
 * tache-retard. La maturité calculée supplée donc l'absence de planification.
 */
async function detecterRecoltesMures(userId: string): Promise<AlerteUrgente[]> {
  const cultures = await prisma.culture.findMany({
    where: {
      userId,
      recolteFaite: false,
      terminee: null,
      dateRecolte: null,
      OR: [{ dateSemis: { not: null } }, { datePlantation: { not: null } }],
    },
    select: {
      id: true,
      especeId: true,
      dateSemis: true,
      datePlantation: true,
      espece: { select: { nom: true } },
      planche: { select: { nom: true } },
      itp: { select: { dureeCulture: true } },
    },
  })

  const mures = calculerRecoltesMures(
    cultures.map((culture) => ({
      id: culture.id,
      dateSemis: culture.dateSemis,
      datePlantation: culture.datePlantation,
      recolteFaite: false,
      dureeCultureJours: culture.itp?.dureeCulture ?? null,
      especeNom: culture.espece?.nom ?? culture.especeId,
      plancheNom: culture.planche?.nom ?? null,
    }))
  )

  return mures.map((recolte) => {
    const localisation = recolte.plancheNom ? ` de la planche ${recolte.plancheNom}` : ""
    const quand =
      recolte.joursRestants > 0
        ? `mûre dans ${recolte.joursRestants} jour${recolte.joursRestants > 1 ? "s" : ""}`
        : recolte.joursRestants === 0
          ? "mûre aujourd'hui"
          : `mûre depuis ${-recolte.joursRestants} jour${-recolte.joursRestants > 1 ? "s" : ""}`
    return {
      type: "recolte-mure" as const,
      titre: recolte.plancheNom
        ? `${recolte.especeNom} (planche ${recolte.plancheNom})`
        : recolte.especeNom,
      message: `La culture de ${recolte.especeNom}${localisation} est ${quand} (durée de culture ${recolte.dureeJours} j depuis le semis/plantation). Pensez à récolter.`,
      key: `recolte-mure:${recolte.cultureId}:${recolte.dateMaturite}`,
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Tâches ITP de la semaine (issue #16)
// ─────────────────────────────────────────────────────────────────────────────

/** Champs ITP nécessaires au calcul des opérations hebdomadaires. */
const ITP_TACHE_SELECT = {
  id: true,
  actif: true,
  // Origine : sert au calage climatique du LECTEUR (un ITP perso sans zone
  // décrit la pratique de son auteur dans son climat — aucun décalage pour lui).
  userId: true,
  zoneClimat: true,
  semaineSemis: true,
  semainePlantation: true,
  semaineRecolte: true,
  semaineRecolteFin: true,
  dureeRecolte: true,
} as const

/**
 * Le repli « meilleur ITP de l'espèce » chargeait TOUS les ITP de l'espèce,
 * sans filtre de visibilité : l'itinéraire PRIVÉ d'un autre membre pouvait
 * gagner le départage (il est trié par complétude) et piloter les tâches de la
 * semaine. On borne la relation à ce que cet utilisateur a le droit de voir, et
 * aux itinéraires encore en service.
 */
const cultureItpSelect = (userId: string) =>
  ({
    id: true,
    especeId: true,
    annee: true,
    // Les dates réellement saisies font foi pour les jalons qui en portent une :
    // sans elles, la notification tombait sur la semaine THÉORIQUE de l'ITP
    // pendant que /taches affichait la date stockée.
    dateSemis: true,
    datePlantation: true,
    dateRecolte: true,
    semisFait: true,
    plantationFaite: true,
    recolteFaite: true,
    espece: {
      select: {
        nom: true,
        couleur: true,
        // ITP de l'espèce (repli quand la culture n'a pas d'ITP direct).
        itps: {
          where: { actif: true, OR: visibiliteReferentiel(userId).OR },
          select: ITP_TACHE_SELECT,
        },
      },
    },
    variete: { select: { nom: true } },
    planche: { select: { nom: true, ilot: true } },
    itp: { select: ITP_TACHE_SELECT },
  }) as const

interface ItpCandidat {
  id: string
  actif: boolean
  userId: string | null
  zoneClimat: ZoneClimat | null
  semaineSemis: number | null
  semainePlantation: number | null
  semaineRecolte: number | null
  semaineRecolteFin: number | null
  dureeRecolte: number | null
}

/**
 * Meilleur ITP de référence d'une espèce (repli quand la culture n'a pas
 * d'ITP direct) : actif, applicable à la zone de l'utilisateur, de préférence
 * calé sur SA zone, sinon générique (zoneClimat null), puis le plus complet
 * (champs semis/plantation/récolte renseignés) ; départage déterministe par id.
 */
function meilleurItpEspece(itps: ItpCandidat[], userZone: ZoneClimat | null): ItpCandidat | null {
  const candidats = itps.filter(
    (itp) =>
      itp.actif &&
      itpApplicableAZone(itp.zoneClimat, userZone) &&
      (itp.semaineSemis != null || itp.semainePlantation != null || itp.semaineRecolte != null)
  )
  if (candidats.length === 0) return null

  const zones = candidats.filter((itp) => itp.zoneClimat === userZone)
  const generiques = candidats.filter((itp) => itp.zoneClimat == null)
  const pool = zones.length > 0 ? zones : generiques.length > 0 ? generiques : candidats

  const completude = (itp: ItpCandidat): number =>
    [itp.semaineSemis, itp.semainePlantation, itp.semaineRecolte].filter((v) => v != null).length
  return [...pool].sort(
    (a, b) => completude(b) - completude(a) || a.id.localeCompare(b.id)
  )[0]
}

/**
 * Tâches ITP de la semaine courante (lundi → dimanche) pour un utilisateur :
 * opérations (semis/plantation/récolte) du calendrier ITP de ses cultures
 * actives dont la fenêtre couvre la semaine. Non faites uniquement.
 */
export async function chargerTachesItpSemaine(
  userId: string,
  aujourdHui?: Date
): Promise<TacheItpSemaine[]> {
  const [userZone, cultures] = await Promise.all([
    zoneEffectiveUser(prisma, userId),
    prisma.culture.findMany({
      // Cultures actives : cycle non terminé (NULL = en cours, 'v' = vivace
      // continue). 'x' (terminée) et 'NS' sont exclues.
      where: { userId, OR: [{ terminee: null }, { terminee: "v" }] },
      select: cultureItpSelect(userId),
    }),
  ])

  const inputs: CultureItpInput[] = cultures.map((culture) => ({
    id: culture.id,
    especeId: culture.especeId,
    annee: culture.annee,
    dateSemis: culture.dateSemis,
    datePlantation: culture.datePlantation,
    dateRecolte: culture.dateRecolte,
    semisFait: culture.semisFait,
    plantationFaite: culture.plantationFaite,
    recolteFaite: culture.recolteFaite,
    couleur: culture.espece?.couleur ?? null,
    especeNom: culture.espece?.nom ?? null,
    varieteNom: culture.variete?.nom ?? null,
    plancheName: culture.planche?.nom ?? null,
    ilot: culture.planche?.ilot ?? null,
    itp: (culture.itp ??
      meilleurItpEspece((culture.espece?.itps ?? []) as ItpCandidat[], userZone)) as ItpSemaineInput |
      null,
  }))

  return tachesItpSemainePourCultures(inputs, { userZone, lecteurId: userId, aujourdHui })
}

/** Verbe d'action pour le message de l'alerte dédiée. */
const VERBE_PAR_TYPE: Record<TacheItpSemaine["type"], string> = {
  semis: "Semer",
  plantation: "Planter",
  recolte: "Récolter",
}

/**
 * Alerte dédiée « tâches ITP de la semaine » : UN email par utilisateur et par
 * semaine — la clé `tache-itp-semaine:YYYY-Sww` (anti-redondance store) change
 * chaque lundi, donc l'alerte ne repart qu'une fois par semaine, quel que soit
 * le nombre de scans. Résume les opérations ITP de la semaine sur les cultures
 * actives ; le détail vit dans le résumé quotidien.
 */
async function detecterTachesItpSemaine(userId: string): Promise<AlerteUrgente[]> {
  const taches = await chargerTachesItpSemaine(userId)
  if (taches.length === 0) return []

  const semaine = semaineCourante()
  const types: TacheItpSemaine["type"][] = ["semis", "plantation", "recolte"]
  const detail = types
    .map((type) => taches.filter((tache) => tache.type === type))
    .filter((liste) => liste.length > 0)
    // Garde-fou anti-spam : on résume, le détail complet vit dans le résumé quotidien.
    .map((liste) => {
      const verbe = VERBE_PAR_TYPE[liste[0].type]
      const libelles = liste
        .slice(0, 12)
        .map((tache) =>
          tache.plancheName ? `${tache.especeNom} (planche ${tache.plancheName})` : tache.especeNom
        )
      const reste = liste.length - libelles.length
      return `${verbe} ${libelles.join(", ")}${reste > 0 ? `… et ${reste} autre${reste > 1 ? "s" : ""}` : ""}`
    })
    .join(" ; ")

  return [
    {
      type: "tache-itp-semaine",
      titre: `semaine S${semaine.semaine}`,
      message: `Cette semaine (du ${formatDateFr(semaine.debutIso)} au ${formatDateFr(semaine.finIso)}) : ${detail}.`,
      key: `tache-itp-semaine:${semaine.annee}-S${semaine.semaine}`,
    },
  ]
}

/** Toutes les alertes urgentes détectables pour un utilisateur. */
export async function detecterAlertesUrgentes(userId: string): Promise<AlerteUrgente[]> {
  const [irrigations, irrigationsEnRetard, associations, retards, recoltes, itpSemaine, stocksCritiques] = await Promise.all([
    detecterIrrigationsInutiles(userId),
    detecterIrrigationsEnRetard(userId),
    detecterAssociationsIncompatibles(userId),
    detecterTachesEnRetard(userId),
    detecterRecoltesMures(userId),
    detecterTachesItpSemaine(userId),
    detecterStocksCritiques(userId),
  ])
  return [
    ...irrigations,
    ...irrigationsEnRetard,
    ...associations,
    ...retards,
    ...recoltes,
    ...itpSemaine,
    ...stocksCritiques,
  ]
}
