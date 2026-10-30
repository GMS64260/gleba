/**
 * Adaptateurs d'ingestion : d'un envoi de serveur de réseau (ou d'un outil de
 * la ferme) à des trames normalisées. Purs, sans base : la route les choisit
 * par le type du connecteur, `ingestion.ts` enregistre.
 *
 * Formats lus :
 * - TTN v3 (webhook « Uplink ») : `end_device_ids.dev_eui` (à défaut, appareil
 *   ABP : `application_id/device_id`, identifiants immuables de TTN),
 *   `uplink_message.decoded_payload`, `received_at`, `rx_metadata[].rssi/snr`,
 *   `version_ids.brand_id/model_id` ; un uplink simulé depuis la console
 *   (`simulated: true`) fait voir le capteur sans écrire de mesure ;
 * - ChirpStack v4 (intégration HTTP, JSON, `?event=up|status`) :
 *   `deviceInfo.devEui`, `object`, `time`, `rxInfo[].rssi/snr`, `batteryLevel`.
 *   Le nom du profil d'appareil est un libellé libre : il ne choisit aucun
 *   profil de décodage (choix fait à l'écran, par id) ;
 * - générique : `{ capteur, mesures, mesureeA?, modele?, batterie?, lat?, lng? }`
 *   ou `{ trames: [...] }` (20 au plus).
 *
 * Dates : ISO 8601 AVEC fuseau (`Z` ou `±hh:mm`) seulement. Une heure sans
 * fuseau serait lue à l'heure du conteneur (Paris) : 10 h à Nouméa deviendrait
 * 9 h dans le futur.
 */
import { z } from "zod"
import { aProfil, aplatir, extrairePosition } from "./decodage"
import { normaliserDevEui, normaliserIdentifiantGenerique } from "./identifiants"
import type { TypeConnecteur } from "./connecteurs"

export interface TrameNormalisee {
  identifiantExterne: string
  modele: string | null
  /** Instant de la mesure ; à défaut d'horloge du capteur, réception par le réseau. */
  mesureeA: Date
  valeurs: Array<[string, number]>
  batterie: number | null
  rssi: number | null
  snr: number | null
  position: { lat: number; lng: number } | null
  /** Trame reçue sans valeur lisible (décodeur absent côté serveur de réseau…). */
  avertissement: string | null
}

export type ResultatAdaptation =
  | { ok: true; trames: TrameNormalisee[]; ignore: string | null }
  | { ok: false; erreur: string }

export const MAX_TRAMES_GENERIQUES = 20

const ISO_AVEC_FUSEAU = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/i

function objet(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function nombre(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null
}

/**
 * Métadonnées radio et batterie annoncées par le serveur de réseau : une
 * valeur hors bornes est ignorée (la trame reste lue), comme une valeur non
 * numérique. RSSI : la sensibilité LoRa s'arrête vers -148 dBm et 0 dBm (1 mW
 * reçu) n'est pas atteint à la puissance légale en 868 MHz ; SNR : démodulé
 * jusqu'à -20 dB, rapporté sous +20 dB. Batterie ChirpStack : pourcentage.
 */
const BORNES = { rssi: [-160, 0], snr: [-30, 30], batterie: [0, 100] } as const

function nombreBorne(v: unknown, [min, max]: readonly [number, number]): number | null {
  const n = nombre(v)
  return n !== null && n >= min && n <= max ? n : null
}

/** `2026-02-30` passerait chez V8 (2 mars) : le jour, l'heure et la minute doivent exister. */
function dateCalendaireValide(texte: string): boolean {
  const [a, m, j, h, min] = [texte.slice(0, 4), texte.slice(5, 7), texte.slice(8, 10), texte.slice(11, 13), texte.slice(14, 16)].map(Number)
  const jour = new Date(Date.UTC(a, m - 1, j))
  return jour.getUTCFullYear() === a && jour.getUTCMonth() === m - 1 && jour.getUTCDate() === j && h <= 23 && min <= 59
}

function date(v: unknown): Date | null {
  if (typeof v !== "string") return null
  const texte = v.trim()
  if (!ISO_AVEC_FUSEAU.test(texte) || !dateCalendaireValide(texte)) return null
  const d = new Date(texte)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Meilleure réception parmi les passerelles (RSSI le plus fort, et son SNR). */
function meilleureReception(liste: unknown): { rssi: number | null; snr: number | null } {
  let meilleur: { rssi: number | null; snr: number | null } = { rssi: null, snr: null }
  if (!Array.isArray(liste)) return meilleur
  for (const r of liste) {
    const o = objet(r)
    const rssi = nombreBorne(o?.rssi, BORNES.rssi) ?? nombreBorne(o?.channel_rssi, BORNES.rssi)
    if (rssi !== null && (meilleur.rssi === null || rssi > meilleur.rssi)) meilleur = { rssi, snr: nombreBorne(o?.snr, BORNES.snr) }
  }
  return meilleur
}

function trameDecodee(
  identifiantExterne: string,
  decode: unknown,
  base: Omit<TrameNormalisee, "identifiantExterne" | "valeurs" | "position" | "avertissement">,
  sansDecodeur: string,
): TrameNormalisee {
  const valeurs = aplatir(decode)
  const position = extrairePosition(decode)
  return {
    identifiantExterne,
    ...base,
    valeurs,
    position,
    avertissement: !objet(decode)
      ? sansDecodeur
      : valeurs.length === 0 && !position
        ? "Charge décodée sans valeur numérique lisible (tableau, texte) : ce modèle demande un profil de décodage."
        : null,
  }
}

export function adapterTtn(corps: unknown, maintenant: Date): ResultatAdaptation {
  const racine = objet(corps)
  if (!racine) return { ok: false, erreur: "Corps JSON attendu" }
  const uplink = objet(racine.uplink_message)
  if (!uplink) {
    return { ok: true, trames: [], ignore: "Événement TTN sans mesure : seuls les messages « Uplink » sont lus." }
  }
  const ids = objet(racine.end_device_ids)
  const application = objet(ids?.application_ids)?.application_id
  const devEui =
    normaliserDevEui(ids?.dev_eui) ??
    (typeof application === "string" && typeof ids?.device_id === "string"
      ? normaliserIdentifiantGenerique(`ttn:${application}/${ids.device_id}`)
      : null)
  if (!devEui) return { ok: false, erreur: "Ni dev_eui ni application_id/device_id exploitables dans end_device_ids" }
  const versions = objet(uplink.version_ids)
  const modele =
    typeof versions?.brand_id === "string" && typeof versions?.model_id === "string"
      ? `${versions.brand_id}/${versions.model_id}`
      : null
  const { rssi, snr } = meilleureReception(uplink.rx_metadata)
  const mesureeA = date(uplink.received_at) ?? date(racine.received_at) ?? maintenant
  if (racine.simulated === true) {
    return {
      ok: true,
      ignore: null,
      trames: [{
        identifiantExterne: devEui, modele, mesureeA, valeurs: [], batterie: null, rssi: null, snr: null, position: null,
        avertissement: "Dernier envoi : uplink simulé depuis la console TTN, reçu mais non enregistré comme mesure.",
      }],
    }
  }
  return {
    ok: true,
    ignore: null,
    trames: [
      trameDecodee(
        devEui,
        uplink.decoded_payload,
        { modele, mesureeA, batterie: null, rssi, snr },
        "Trame non décodée : ajoutez un décodeur (Payload formatter) au capteur dans TTN.",
      ),
    ],
  }
}

export function adapterChirpstack(corps: unknown, evenement: string | null, maintenant: Date): ResultatAdaptation {
  const racine = objet(corps)
  if (!racine) return { ok: false, erreur: "Corps JSON attendu (encodage JSON de l'intégration HTTP)" }
  if (evenement && evenement !== "up" && evenement !== "status") {
    return { ok: true, trames: [], ignore: `Événement ChirpStack « ${evenement} » ignoré : seuls « up » et « status » sont lus.` }
  }
  const infos = objet(racine.deviceInfo)
  const devEui = normaliserDevEui(infos?.devEui)
  if (!devEui) return { ok: false, erreur: "deviceInfo.devEui absent ou invalide" }
  const modele = null
  const mesureeA = date(racine.time) ?? maintenant

  // Événement d'état : niveau de batterie remonté par le serveur de réseau.
  const estStatut = evenement === "status" || (!("object" in racine) && !("data" in racine) && "margin" in racine)
  if (estStatut) {
    const sansBatterie = racine.batteryLevelUnavailable === true || racine.externalPowerSource === true
    const batterie = sansBatterie ? null : nombreBorne(racine.batteryLevel, BORNES.batterie)
    return {
      ok: true,
      ignore: null,
      trames: [{ identifiantExterne: devEui, modele, mesureeA, valeurs: [], batterie, rssi: null, snr: null, position: null, avertissement: null }],
    }
  }

  const { rssi, snr } = meilleureReception(racine.rxInfo)
  return {
    ok: true,
    ignore: null,
    trames: [
      trameDecodee(
        devEui,
        racine.object,
        { modele, mesureeA, batterie: null, rssi, snr },
        "Trame non décodée : ajoutez un codec au profil de l'appareil dans ChirpStack.",
      ),
    ],
  }
}

const trameGenerique = z.object({
  capteur: z.string(),
  mesures: z.record(z.string(), z.unknown()).default({}),
  mesureeA: z.string().optional(),
  // Profil de décodage Gleba (`dragino/lse01`…), jamais un libellé libre.
  modele: z.string().refine(aProfil, "profil de décodage inconnu").optional(),
  batterie: z.number().min(0).max(100).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
})

const envoiGenerique = z.union([
  z.object({ trames: z.array(trameGenerique).min(1).max(MAX_TRAMES_GENERIQUES) }),
  trameGenerique,
])

export function adapterGenerique(corps: unknown, maintenant: Date): ResultatAdaptation {
  const lu = envoiGenerique.safeParse(corps)
  if (!lu.success) {
    return { ok: false, erreur: `Format générique invalide : ${lu.error.issues.map((i) => `${i.path.join(".") || "corps"} ${i.message}`).join(", ")}` }
  }
  const brutes = "trames" in lu.data ? lu.data.trames : [lu.data]
  const trames: TrameNormalisee[] = []
  // Sans `mesureeA`, toutes les trames d'un envoi prennent l'instant de
  // réception : deux trames du même capteur se confondraient (la seconde
  // serait comptée comme doublon et perdue).
  const sansDate = new Set<string>()
  for (const t of brutes) {
    const identifiantExterne = normaliserIdentifiantGenerique(t.capteur)
    if (!identifiantExterne) return { ok: false, erreur: `Identifiant de capteur invalide : « ${t.capteur.slice(0, 64)} »` }
    let mesureeA = maintenant
    if (t.mesureeA !== undefined) {
      const d = date(t.mesureeA)
      if (!d) return { ok: false, erreur: `Date mesureeA illisible pour ${identifiantExterne} : ISO 8601 avec fuseau attendu (« 2026-10-23T10:00:00Z » ou « …+11:00 »)` }
      mesureeA = d
    } else if (sansDate.has(identifiantExterne)) {
      return { ok: false, erreur: `Plusieurs trames de ${identifiantExterne} sans mesureeA dans le même envoi : datez-les` }
    } else {
      sansDate.add(identifiantExterne)
    }
    trames.push({
      identifiantExterne,
      modele: t.modele ?? null,
      mesureeA,
      valeurs: aplatir(t.mesures),
      batterie: t.batterie ?? null,
      rssi: null,
      snr: null,
      position: t.lat !== undefined && t.lng !== undefined && !(t.lat === 0 && t.lng === 0) ? { lat: t.lat, lng: t.lng } : null,
      avertissement: null,
    })
  }
  return { ok: true, trames, ignore: null }
}

export function adapter(
  type: TypeConnecteur,
  corps: unknown,
  options: { evenement: string | null; maintenant: Date },
): ResultatAdaptation {
  switch (type) {
    case "ttn":
      return adapterTtn(corps, options.maintenant)
    case "chirpstack":
      return adapterChirpstack(corps, options.evenement, options.maintenant)
    case "generique":
      return adapterGenerique(corps, options.maintenant)
  }
}
