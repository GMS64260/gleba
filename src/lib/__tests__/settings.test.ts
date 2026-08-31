import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  parametreFindUnique: vi.fn(),
  parametreUpsert: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  default: {
    parametre: {
      findUnique: mocks.parametreFindUnique,
      upsert: mocks.parametreUpsert,
    },
  },
}))

import prisma from "@/lib/prisma"
import {
  clearSettingsCache,
  getSetting,
  getSettingsWithProvenance,
  setSetting,
  SettingValidationError,
} from "../settings"

const mockedPrisma = prisma as unknown as {
  parametre: {
    findUnique: ReturnType<typeof vi.fn>
    upsert: ReturnType<typeof vi.fn>
  }
}

const envKeys = [
  "NOTIF_ENABLED",
  "NOTIF_RESUME_HEURE",
  "NOTIF_METEO_INTERVAL_MIN",
  "TZ",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
] as const

describe("réglages globaux", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearSettingsCache()
    for (const key of envKeys) delete process.env[key]
    mockedPrisma.parametre.findUnique.mockResolvedValue(null)
    mockedPrisma.parametre.upsert.mockResolvedValue(undefined)
  })

  it("privilégie la valeur en base sur la variable d'environnement", async () => {
    process.env.NOTIF_ENABLED = "true"
    mockedPrisma.parametre.findUnique.mockResolvedValue({ valeur: "false" })

    await expect(getSetting("notif.enabled")).resolves.toBe(false)
  })

  it("utilise la variable d'environnement quand la base est vide", async () => {
    process.env.NOTIF_ENABLED = "false"

    await expect(getSetting("notif.enabled")).resolves.toBe(false)
  })

  it("utilise la valeur par défaut sans base ni variable d'environnement", async () => {
    await expect(getSetting("notif.resumeHeure")).resolves.toBe("07:00")
  })

  it("coerce les booléens et valide les heures", async () => {
    mockedPrisma.parametre.findUnique
      .mockResolvedValueOnce({ valeur: "true" })
      .mockResolvedValueOnce({ valeur: "23:59" })

    await expect(getSetting("notif.enabled")).resolves.toBe(true)
    await expect(getSetting("notif.resumeHeure")).resolves.toBe("23:59")
  })

  it("borne les nombres de configuration des notifications", async () => {
    process.env.NOTIF_METEO_INTERVAL_MIN = "2"
    await expect(getSetting("notif.meteoIntervalMin")).resolves.toBe(5)

    clearSettingsCache()
    process.env.NOTIF_METEO_INTERVAL_MIN = "9999"
    await expect(getSetting("notif.meteoIntervalMin")).resolves.toBe(1440)
  })

  it("rejette une clé absente du registre", async () => {
    await expect(setSetting("notif.inconnue" as never, true)).rejects.toThrow(
      "Clé de réglage inconnue"
    )
  })

  it("rejette une valeur invalide ou hors bornes", async () => {
    await expect(setSetting("notif.enabled", "oui")).rejects.toThrow(
      "Valeur invalide"
    )
    await expect(setSetting("notif.meteoIntervalMin", 2)).rejects.toThrow(
      "Valeur invalide"
    )
    await expect(setSetting("notif.resumeHeure", "7:00")).rejects.toThrow(
      "Valeur invalide"
    )
  })

  it("effectue un upsert avec la valeur normalisée", async () => {
    await setSetting("notif.enabled", false)

    expect(mockedPrisma.parametre.upsert).toHaveBeenCalledWith({
      where: { id: "notif.enabled" },
      create: { id: "notif.enabled", valeur: "false" },
      update: { valeur: "false" },
    })
  })

  it("renvoie le port SMTP par défaut et privilégie la base sur l'environnement", async () => {
    await expect(getSetting("smtp.port")).resolves.toBe(587)

    clearSettingsCache()
    process.env.SMTP_PORT = "465"
    mockedPrisma.parametre.findUnique.mockResolvedValue({ valeur: "25" })

    await expect(getSetting("smtp.port")).resolves.toBe(25)
  })

  it("renvoie le sujet VAPID par défaut", async () => {
    await expect(getSetting("vapid.subject")).resolves.toBe("mailto:contact@gleba.fr")
  })

  it("masque la clé privée VAPID dans getSettingsWithProvenance quand une valeur est présente", async () => {
    mockedPrisma.parametre.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
      if (where.id === "vapid.privateKey") return { valeur: "private" }
      return null
    })

    const resultats = await getSettingsWithProvenance()
    expect(resultats["vapid.privateKey"].valeur).toBe("••••••••")
    expect(resultats["vapid.privateKey"].provenance).toBe("db")
  })

  it("masque le mot de passe SMTP dans getSettingsWithProvenance quand une valeur est présente", async () => {
    mockedPrisma.parametre.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
      if (where.id === "smtp.pass") return { valeur: "mon_mot_de_passe_db" }
      return null
    })

    const resultatsDb = await getSettingsWithProvenance()
    expect(resultatsDb["smtp.pass"].valeur).toBe("••••••••")
    expect(resultatsDb["smtp.pass"].provenance).toBe("db")

    clearSettingsCache()
    mockedPrisma.parametre.findUnique.mockResolvedValue(null)
    process.env.SMTP_PASS = "mon_mot_de_passe_env"

    const resultatsEnv = await getSettingsWithProvenance()
    expect(resultatsEnv["smtp.pass"].valeur).toBe("••••••••")
    expect(resultatsEnv["smtp.pass"].provenance).toBe("env")

    clearSettingsCache()
    delete process.env.SMTP_PASS

    const resultatsDefaut = await getSettingsWithProvenance()
    expect(resultatsDefaut["smtp.pass"].valeur).toBe("")
    expect(resultatsDefaut["smtp.pass"].provenance).toBe("defaut")
  })

  it("rejette l'enregistrement de la valeur masquée pour le mot de passe SMTP", async () => {
    await expect(setSetting("smtp.pass", "••••••••")).rejects.toThrow(
      SettingValidationError
    )
    await expect(setSetting("smtp.pass", "••••••••")).rejects.toThrow(
      "Le mot de passe SMTP masqué ne peut pas être enregistré — saisissez la valeur réelle"
    )
  })
})
