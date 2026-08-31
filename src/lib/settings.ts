import prisma from "@/lib/prisma"

/** Type de valeur accepté par un réglage global. */
export type SettingType = "boolean" | "heure" | "nombre" | "texte"

export type SettingValue = boolean | number | string
export type SettingProvenance = "db" | "env" | "defaut"

type SettingDefinition<T extends SettingValue = SettingValue> = {
  name: string
  type: SettingType
  defaultValue: T
  envKey?: string
  min?: number
  max?: number
  integer?: boolean
  secret?: boolean
}

type SettingsRegistry = {
  "notif.enabled": SettingDefinition<boolean>
  "notif.resumeHeure": SettingDefinition<string>
  "notif.meteoIntervalMin": SettingDefinition<number>
  "notif.timezone": SettingDefinition<string>
  "seuil.gel": SettingDefinition<number>
  "seuil.canicule": SettingDefinition<number>
  "seuil.ventFort": SettingDefinition<number>
  "seuil.pluieAbondante": SettingDefinition<number>
  "smtp.host": SettingDefinition<string>
  "smtp.port": SettingDefinition<number>
  "smtp.user": SettingDefinition<string>
  "smtp.pass": SettingDefinition<string>
  "smtp.from": SettingDefinition<string>
  "vapid.publicKey": SettingDefinition<string>
  "vapid.privateKey": SettingDefinition<string>
  "vapid.subject": SettingDefinition<string>
}

/** Registre des réglages exposables par l'interface d'administration. */
export const settingsRegistry: SettingsRegistry = {
  "notif.enabled": {
    name: "notif.enabled",
    type: "boolean",
    defaultValue: true,
    envKey: "NOTIF_ENABLED",
  },
  "notif.resumeHeure": {
    name: "notif.resumeHeure",
    type: "heure",
    defaultValue: "07:00",
    envKey: "NOTIF_RESUME_HEURE",
  },
  "notif.meteoIntervalMin": {
    name: "notif.meteoIntervalMin",
    type: "nombre",
    defaultValue: 30,
    envKey: "NOTIF_METEO_INTERVAL_MIN",
    min: 5,
    max: 1440,
    integer: true,
  },
  "notif.timezone": {
    name: "notif.timezone",
    type: "texte",
    defaultValue: "Europe/Paris",
    envKey: "TZ",
  },
  "seuil.gel": {
    name: "seuil.gel",
    type: "nombre",
    defaultValue: 0,
  },
  "seuil.canicule": {
    name: "seuil.canicule",
    type: "nombre",
    defaultValue: 35,
  },
  "seuil.ventFort": {
    name: "seuil.ventFort",
    type: "nombre",
    defaultValue: 50,
  },
  "seuil.pluieAbondante": {
    name: "seuil.pluieAbondante",
    type: "nombre",
    defaultValue: 20,
  },
  "smtp.host": {
    name: "smtp.host",
    type: "texte",
    defaultValue: "",
    envKey: "SMTP_HOST",
  },
  "smtp.port": {
    name: "smtp.port",
    type: "nombre",
    defaultValue: 587,
    envKey: "SMTP_PORT",
    min: 1,
    max: 65535,
    integer: true,
  },
  "smtp.user": {
    name: "smtp.user",
    type: "texte",
    defaultValue: "",
    envKey: "SMTP_USER",
  },
  "smtp.pass": {
    name: "smtp.pass",
    type: "texte",
    defaultValue: "",
    envKey: "SMTP_PASS",
    secret: true,
  },
  "smtp.from": {
    name: "smtp.from",
    type: "texte",
    defaultValue: "",
    envKey: "SMTP_FROM",
  },
  "vapid.publicKey": {
    name: "vapid.publicKey",
    type: "texte",
    defaultValue: "",
    envKey: "VAPID_PUBLIC_KEY",
  },
  "vapid.privateKey": {
    name: "vapid.privateKey",
    type: "texte",
    defaultValue: "",
    envKey: "VAPID_PRIVATE_KEY",
    secret: true,
  },
  "vapid.subject": {
    name: "vapid.subject",
    type: "texte",
    defaultValue: "mailto:contact@gleba.fr",
    envKey: "VAPID_SUBJECT",
  },
}

export type SettingKey = keyof SettingsRegistry
type SettingValueFor<K extends SettingKey> = SettingsRegistry[K]["defaultValue"]
type SettingCacheEntry = {
  value: SettingValue
  provenance: SettingProvenance
  expiresAt: number
}

type SettingDetails = {
  valeur: SettingValue
  provenance: SettingProvenance
}

const cacheTtlMs = 60_000
const settingsCache = new Map<SettingKey, SettingCacheEntry>()

/** Erreur retournée pour une clé ou une valeur de réglage invalide. */
export class SettingValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SettingValidationError"
  }
}

/** Vérifie qu'une chaîne correspond à une clé du registre. */
export function isSettingKey(cle: string): cle is SettingKey {
  return Object.prototype.hasOwnProperty.call(settingsRegistry, cle)
}

function getSettingDefinition(cle: string): SettingDefinition {
  if (!isSettingKey(cle)) {
    throw new SettingValidationError(`Clé de réglage inconnue : ${cle}`)
  }
  return settingsRegistry[cle]
}

function parseSettingValue(
  definition: SettingDefinition,
  rawValue: unknown,
  clampNumbers: boolean
): SettingValue | null {
  if (definition.type === "boolean") {
    if (typeof rawValue === "boolean") return rawValue
    if (typeof rawValue !== "string") return null

    const normalized = rawValue.trim().toLowerCase()
    if (normalized === "true") return true
    if (normalized === "false") return false
    return null
  }

  if (definition.type === "heure") {
    if (typeof rawValue !== "string") return null
    const normalized = rawValue.trim()
    return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(normalized) ? normalized : null
  }

  if (definition.type === "nombre") {
    const value = typeof rawValue === "number"
      ? rawValue
      : typeof rawValue === "string" && rawValue.trim() !== ""
        ? Number(rawValue.trim())
        : Number.NaN

    if (!Number.isFinite(value) || (definition.integer && !Number.isInteger(value))) {
      return null
    }

    if (definition.min !== undefined && value < definition.min) {
      return clampNumbers ? definition.min : null
    }
    if (definition.max !== undefined && value > definition.max) {
      return clampNumbers ? definition.max : null
    }
    return value
  }

  return typeof rawValue === "string" ? rawValue : null
}

function serializeSettingValue(value: SettingValue): string {
  return typeof value === "string" ? value : String(value)
}

async function resolveSetting(cle: SettingKey): Promise<SettingCacheEntry> {
  const cached = settingsCache.get(cle)
  if (cached && cached.expiresAt > Date.now()) return cached

  const definition = settingsRegistry[cle]
  const row = await prisma.parametre.findUnique({ where: { id: cle } })
  const candidates: Array<{ rawValue: unknown; provenance: SettingProvenance }> = [
    { rawValue: row?.valeur, provenance: "db" },
    { rawValue: definition.envKey ? process.env[definition.envKey] : undefined, provenance: "env" },
    { rawValue: definition.defaultValue, provenance: "defaut" },
  ]

  for (const candidate of candidates) {
    const value = parseSettingValue(definition, candidate.rawValue, true)
    if (value !== null) {
      const entry = {
        value,
        provenance: candidate.provenance,
        expiresAt: Date.now() + cacheTtlMs,
      }
      settingsCache.set(cle, entry)
      return entry
    }
  }

  throw new Error(`Aucune valeur valide pour le réglage ${cle}`)
}

/** Lit la valeur effective d'un réglage global. */
export async function getSetting<K extends SettingKey>(
  cle: K
): Promise<SettingValueFor<K>> {
  const resolved = await resolveSetting(cle)
  return resolved.value as SettingValueFor<K>
}

/** Lit toutes les valeurs effectives du registre. */
export async function getSettings(): Promise<{
  [K in SettingKey]: SettingValueFor<K>
}> {
  const entries = await Promise.all(
    (Object.keys(settingsRegistry) as SettingKey[]).map(async (cle) => [
      cle,
      await getSetting(cle),
    ] as const)
  )
  return Object.fromEntries(entries) as {
    [K in SettingKey]: SettingValueFor<K>
  }
}

/** Lit les valeurs effectives avec leur provenance pour l'API d'administration. */
export async function getSettingsWithProvenance(): Promise<
  Record<SettingKey, SettingDetails>
> {
  const entries = await Promise.all(
    (Object.keys(settingsRegistry) as SettingKey[]).map(async (cle) => {
      const definition = settingsRegistry[cle]
      const resolved = await resolveSetting(cle)
      let valeur = resolved.value
      if (
        definition.secret &&
        typeof valeur === "string" &&
        valeur !== "" &&
        (resolved.provenance === "db" || resolved.provenance === "env")
      ) {
        valeur = "••••••••"
      }
      return [cle, { valeur, provenance: resolved.provenance }] as const
    })
  )
  return Object.fromEntries(entries) as Record<SettingKey, SettingDetails>
}

/** Enregistre une valeur validée et invalide le cache du réglage concerné. */
export function setSetting<K extends SettingKey>(
  cle: K,
  valeur: unknown
): Promise<SettingValueFor<K>>
export function setSetting(cle: string, valeur: unknown): Promise<SettingValue>
export async function setSetting(cle: string, valeur: unknown): Promise<SettingValue> {
  const definition = getSettingDefinition(cle)
  if (definition.secret && valeur === "••••••••") {
    const message = cle === "smtp.pass"
      ? "Le mot de passe SMTP masqué ne peut pas être enregistré — saisissez la valeur réelle"
      : "La valeur masquée ne peut pas être enregistrée — saisissez la valeur réelle"
    throw new SettingValidationError(message)
  }
  const normalizedValue = parseSettingValue(definition, valeur, false)
  if (normalizedValue === null) {
    throw new SettingValidationError(`Valeur invalide pour le réglage ${cle}`)
  }

  await prisma.parametre.upsert({
    where: { id: cle },
    create: { id: cle, valeur: serializeSettingValue(normalizedValue) },
    update: { valeur: serializeSettingValue(normalizedValue) },
  })

  settingsCache.delete(cle as SettingKey)
  return normalizedValue
}

/** Vide le cache mémoire, principalement utile pour isoler les tests. */
export function clearSettingsCache(): void {
  settingsCache.clear()
}
