/**
 * Détection PURE des conditions à risque (météo + irrigation).
 *
 * Consomme les données déjà fetchées par `@/lib/meteo` (fetchOpenMeteoForecast,
 * fetchOpenMeteoHistory) — aucune duplication des appels API ici.
 *
 * Seuils calibrés pour des NOTIFICATIONS par email (donc volontairement plus
 * exigeants que les alertes in-app de `meteo-agro.genererAlertesMeteo` :
 * un email pour 19 km/h de vent serait du spam) :
 *   - gel         : tempMin <= 0 °C
 *   - canicule    : tempMax >= 35 °C
 *   - vent fort   : windSpeedMax >= 50 km/h
 *   - pluie abondante : precipitation >= 20 mm/jour
 *   - orage       : code WMO courant 95/96/99 (orage, grêle)
 */

import type { MeteoActuelle, MeteoPrevision } from "@/lib/meteo"
import { DUREE_CULTURE_DEFAUT } from "@/lib/plan-croissance"
import type { AlerteMeteoNotification, TypeAlerteMeteo } from "./types"

export const SEUILS_METEO = {
  gel: { tempMin: 0, danger: -3 },
  canicule: { tempMax: 35, danger: 40 },
  ventFort: { vitesse: 50, danger: 70 },
  pluieAbondante: { mm: 20, danger: 40 },
  codesOrage: [95, 96, 99] as readonly number[],
} as const

/** Code WMO d'un orage avec grêle (danger). */
const CODES_GRÊLE = [96, 99]

function todayIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`
}

/**
 * Détecte les alertes météo notifiables sur l'horizon demandé (défaut : tous
 * les jours de la prévision). En temps réel on limite à 48 h ; le résumé du
 * matin utilise la journée courante.
 */
export function detecterAlertesMeteo(
  previsions: MeteoPrevision[],
  current: MeteoActuelle | null = null,
  options: { horizonJours?: number } = {}
): AlerteMeteoNotification[] {
  const horizon = options.horizonJours ?? previsions.length
  const alertes: AlerteMeteoNotification[] = []

  for (let i = 0; i < Math.min(horizon, previsions.length); i++) {
    const jour = previsions[i]
    if (!jour) continue

    // ── Gel ──
    if (jour.tempMin <= SEUILS_METEO.gel.tempMin) {
      alertes.push({
        type: "gel",
        date: jour.date,
        niveau: jour.tempMin <= SEUILS_METEO.gel.danger ? "danger" : "attention",
        message: `Risque de gel : ${jour.tempMin}°C prévu`,
        details:
          jour.tempMin <= SEUILS_METEO.gel.danger
            ? "Gel sévère annoncé. Protéger les cultures sensibles (voile d'hivernage, paillage, tunnel). Risque fort pour les semis récents et les arbres en floraison."
            : "Gel léger possible. Surveiller les cultures non protégées et les semis récents ; un voile de protection peut suffire.",
        key: `gel:${jour.date}`,
      })
    }

    // ── Canicule ──
    if (jour.tempMax >= SEUILS_METEO.canicule.tempMax) {
      alertes.push({
        type: "canicule",
        date: jour.date,
        niveau: jour.tempMax >= SEUILS_METEO.canicule.danger ? "danger" : "attention",
        message: `Canicule : ${jour.tempMax}°C prévu`,
        details:
          "Augmenter la fréquence d'irrigation, ombrer les cultures sensibles (salades, épinards). Arroser tôt le matin ou le soir pour limiter l'évaporation.",
        key: `canicule:${jour.date}`,
      })
    }

    // ── Vent fort ──
    if (jour.windSpeedMax >= SEUILS_METEO.ventFort.vitesse) {
      alertes.push({
        type: "vent",
        date: jour.date,
        niveau: jour.windSpeedMax >= SEUILS_METEO.ventFort.danger ? "danger" : "attention",
        message: `Vent fort : ${Math.round(jour.windSpeedMax)} km/h attendu`,
        details:
          "Éviter tout traitement phytosanitaire (interdit au-delà de 19 km/h). Brise-vent et tuteurage à vérifier ; reporter les semis en plein vent si possible.",
        key: `vent:${jour.date}`,
      })
    }

    // ── Pluie abondante ──
    if (jour.precipitation >= SEUILS_METEO.pluieAbondante.mm) {
      alertes.push({
        type: "pluie",
        date: jour.date,
        niveau: jour.precipitation >= SEUILS_METEO.pluieAbondante.danger ? "danger" : "attention",
        message: `Pluie abondante : ${jour.precipitation} mm prévus`,
        details:
          "Reporter les semis et plantations si possible ; surveiller l'engorgement des planches et la sensibilité des jeunes plants. L'irrigation des prochains jours sera probablement inutile.",
        key: `pluie:${jour.date}`,
      })
    }
  }

  // ── Orage (conditions actuelles, code WMO) ──
  if (current && SEUILS_METEO.codesOrage.includes(current.weatherCode)) {
    const avecGrêle = CODES_GRÊLE.includes(current.weatherCode)
    alertes.push({
      type: "orage",
      date: todayIso(),
      niveau: avecGrêle ? "danger" : "attention",
      message: `Orage${avecGrêle ? " avec grêle" : ""} en cours : ${current.weatherDescription}`,
      details: avecGrêle
        ? "Risque de grêle : mettre à l'abri les plants les plus précieux, fermer les tunnels. Débrancher les équipements électriques sensibles."
        : "Orage à proximité : couvrir les semis sensibles si possible ; rester attentif aux rafales.",
      key: `orage:${todayIso()}`,
    })
  }

  return alertes
}

export const SEUILS_IRRIGATION_INUTILE = {
  pluiePrevue: 5, // mm prévus le jour J → irrigation inutile
  pluieRecente: 5, // mm cumulés sur 3 j
  joursCouverture: 3,
} as const

/**
 * Décide si une irrigation planifiée est probablement inutile (même heuristique
 * que la route /api/calendrier, factorisée pour être testable et réutilisée
 * par les alertes temps réel).
 */
export function deciderIrrigationInutile(opts: {
  pluiePrevue: number | null
  pluieRecente3j: number
  joursAvant: number
}): boolean {
  const { pluiePrevue, pluieRecente3j, joursAvant } = opts
  const inutileParPluieRecente =
    pluieRecente3j >= SEUILS_IRRIGATION_INUTILE.pluieRecente &&
    joursAvant <= SEUILS_IRRIGATION_INUTILE.joursCouverture
  const inutileParPrevision =
    pluiePrevue !== null && pluiePrevue >= SEUILS_IRRIGATION_INUTILE.pluiePrevue
  return inutileParPluieRecente || inutileParPrevision
}

/** Date locale du serveur (fuseau TZ, ex. Europe/Paris) au format YYYY-MM-DD. */
export function dateLocaleIso(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/** Début de journée locale (minuit) sous forme de Date. */
export function debutDeJournee(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** Fin de journée locale (minuit + 1 jour). */
export function finDeJournee(date: Date = new Date()): Date {
  const start = debutDeJournee(date)
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1)
}

export function formatDateFr(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number)
  if (!y || !m || !d) return iso
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`
}

/** Jour de la semaine + date en français (ex. « jeudi 13 août »). */
const FORMATTEUR_DATE_LONGUE = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
})

/**
 * Temporalité lisible d'une alerte météo pour le corps de l'email :
 *   - « Aujourd'hui (jeudi 13 août) » si la date est le jour courant,
 *   - « Demain (vendredi 14 août) » si c'est le lendemain,
 *   - « le samedi 15 août » sinon.
 * `reference` ne sert qu'aux tests (rend la fonction déterministe).
 */
export function formaterTemporaliteAlerte(dateIso: string, reference: Date = new Date()): string {
  const [y, m, d] = dateIso.split("-").map(Number)
  if (!y || !m || !d) return dateIso
  const date = new Date(y, m - 1, d)
  const diffJours = Math.round(
    (debutDeJournee(date).getTime() - debutDeJournee(reference).getTime()) / 86400000
  )
  const label = FORMATTEUR_DATE_LONGUE.format(date)
  if (diffJours === 0) return `Aujourd'hui (${label})`
  if (diffJours === 1) return `Demain (${label})`
  return `le ${label}`
}

/** Indication informative du moment de la journée concerné (petite ligne de l'email). */
export function indicationHoraireAlerte(type: TypeAlerteMeteo): string {
  switch (type) {
    case "gel":
      return "Risque de gel en fin de nuit / au lever du jour."
    case "canicule":
      return "Température maximale attendue en début d'après-midi."
    case "vent":
      return "Rafales les plus fortes attendues l'après-midi."
    case "pluie":
      return "Précipitations concentrées sur la journée."
    case "orage":
      return "Orage possible à proximité immédiate."
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Récoltes mûres (issue #16) — maturité calculée depuis le début du cycle
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fenêtre de déclenchement d'une alerte « récolte mûre » : on prévient à
 * J-3 avant la maturité calculée (date semis/plantation + durée culture ITP).
 */
export const FENETRE_RECOLTE_MURE_AVANCE_JOURS = 3

/**
 * Tolérance de dépassement après la maturité (scans manqués, week-end).
 * Au-delà, la culture est soit déjà récoltée, soit oubliée — pas de spam.
 */
export const FENETRE_RECOLTE_MURE_DEPASSEMENT_JOURS = 2

/** Durée de culture (jours) par défaut quand l'ITP de la culture ne la donne pas. */
export const DUREE_CULTURE_FALLBACK_JOURS = DUREE_CULTURE_DEFAUT

const JOUR_MS = 86_400_000

/** Culture potentiellement mûre (données déjà jointes depuis la base). */
export interface CultureRecolteInput {
  id: number
  dateSemis: Date | string | null
  datePlantation: Date | string | null
  /** true → culture déjà récoltée : jamais notifiable. */
  recolteFaite: boolean
  /** Durée de culture en jours de l'ITP rattaché (null → DUREE_CULTURE_FALLBACK_JOURS). */
  dureeCultureJours: number | null
  especeNom: string
  plancheNom: string | null
}

/** Culture détectée comme mûre ou imminente. */
export interface RecolteMure {
  cultureId: number
  especeNom: string
  plancheNom: string | null
  /** Date de maturité calculée (YYYY-MM-DD, fuseau local). */
  dateMaturite: string
  /** Jours restants avant maturité (0 = aujourd'hui, négatif = déjà dépassée). */
  joursRestants: number
  /** Durée de culture utilisée pour le calcul (jours). */
  dureeJours: number
}

function debutJour(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/**
 * Calcule, parmi des cultures actives, celles dont la maturité est atteinte
 * ou imminente. Maturité = date de mise en place (plantation préférée au
 * semis) + durée de culture (ITP de la culture, sinon défaut 90 j).
 *
 * Fenêtre par défaut : [J-3 avant maturité … J+2 après] — voir constantes.
 * Les cultures déjà récoltées sont exclues ; le résultat est trié des plus
 * urgentes aux moins urgentes.
 *
 * Fonction PURE : testable sans Prisma (utilisée par queries.ts pour les
 * alertes temps réel ET le résumé quotidien).
 */
export function calculerRecoltesMures(
  cultures: CultureRecolteInput[],
  aujourdHui: Date = new Date(),
  options: { avanceJours?: number; depassementJours?: number; dureeDefautJours?: number } = {}
): RecolteMure[] {
  const avance = options.avanceJours ?? FENETRE_RECOLTE_MURE_AVANCE_JOURS
  const depassement = options.depassementJours ?? FENETRE_RECOLTE_MURE_DEPASSEMENT_JOURS
  const dureeDefaut = options.dureeDefautJours ?? DUREE_CULTURE_FALLBACK_JOURS

  const reference = debutJour(aujourdHui).getTime()
  const mures: RecolteMure[] = []

  for (const culture of cultures) {
    if (culture.recolteFaite) continue
    const debut = culture.datePlantation ?? culture.dateSemis
    if (!debut) continue
    const debutDate = debut instanceof Date ? debut : new Date(debut)
    if (Number.isNaN(debutDate.getTime())) continue

    const dureeJours = culture.dureeCultureJours ?? dureeDefaut
    if (!Number.isFinite(dureeJours) || dureeJours <= 0) continue

    const maturite = new Date(debutDate.getTime() + dureeJours * JOUR_MS)
    const joursRestants = Math.round((debutJour(maturite).getTime() - reference) / JOUR_MS)
    if (joursRestants > avance || joursRestants < -depassement) continue

    mures.push({
      cultureId: culture.id,
      especeNom: culture.especeNom,
      plancheNom: culture.plancheNom,
      dateMaturite: dateLocaleIso(maturite),
      joursRestants,
      dureeJours,
    })
  }

  return mures.sort((a, b) => a.joursRestants - b.joursRestants)
}
