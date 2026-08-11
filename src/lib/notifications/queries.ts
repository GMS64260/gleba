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
import { alertesAssociations } from "@/lib/associations-alertes"
import {
  calculerRecoltesMures,
  dateLocaleIso,
  debutDeJournee,
  deciderIrrigationInutile,
  detecterAlertesMeteo,
  finDeJournee,
  formatDateFr,
} from "./detect"
import type {
  AlerteMeteoNotification,
  AlerteUrgente,
  DestinataireNotification,
  TacheJour,
} from "./types"

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
// Météo — agrégat prévisions + pluie récente (même approche que /api/calendrier)
// ─────────────────────────────────────────────────────────────────────────────

export interface MeteoParCoord {
  precipParCoordEtJour: Map<string, Map<string, number>>
  pluieRecente3jParCoord: Map<string, number>
}

function coordKey(lat: number, lng: number): string {
  return `${Math.round(lat * 100)}_${Math.round(lng * 100)}`
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
      where: { userId, datePrevue: { gte: start, lte: end } },
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

/** Irrigation(s) du jour probablement inutiles (pluie récente/prévue). */
async function detecterIrrigationsInutiles(userId: string): Promise<AlerteUrgente[]> {
  const start = debutDeJournee()
  const end = finDeJournee()
  const [irrigations, coords] = await Promise.all([
    prisma.irrigationPlanifiee.findMany({
      where: { userId, fait: false, datePrevue: { gte: start, lte: end } },
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

/** Toutes les alertes urgentes détectables pour un utilisateur. */
export async function detecterAlertesUrgentes(userId: string): Promise<AlerteUrgente[]> {
  const [irrigations, associations, retards, recoltes] = await Promise.all([
    detecterIrrigationsInutiles(userId),
    detecterAssociationsIncompatibles(userId),
    detecterTachesEnRetard(userId),
    detecterRecoltesMures(userId),
  ])
  return [...irrigations, ...associations, ...retards, ...recoltes]
}
