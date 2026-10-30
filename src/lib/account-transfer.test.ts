import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  rows: {} as Record<string, Array<Record<string, unknown>>>,
  create: vi.fn(),
  createMany: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
}))

vi.mock("@/lib/prisma", () => {
  const client: object = new Proxy({}, {
    get: (_target, name: string) => {
      if (name === "$transaction") return (action: (tx: object) => Promise<unknown>) => action(client)
      if (name === "$executeRawUnsafe") return async () => 0
      return {
        findMany: (args: unknown) => mocks.findMany(name, args),
        count: (args: unknown) => mocks.count(name, args),
        create: (args: { data: Record<string, unknown> }) => mocks.create(name, args),
        createMany: (args: { data: Array<Record<string, unknown>>; skipDuplicates?: boolean }) => mocks.createMany(name, args),
      }
    },
  })
  return { default: client }
})

import { exportAccount, importAccount } from "./account-transfer"
import { SEUIL_MESURES_BRUTES_EXPORT } from "@/lib/capteurs/connecteurs"

describe("transfert des identifiants BigInt des capteurs", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.rows = {
      connecteurCapteurs: [{ id: "conn-1", userId: "source", nom: "Banc", type: "generique", jetonHash: "empreinte", jetonPrefixe: "glc_essai" }],
      capteur: [{ id: "cap-1", userId: "source", connecteurId: "conn-1", identifiantExterne: "sonde", clesRecues: ["TempC"], clesInconnues: ["TempC"] }],
      mesureCapteur: [
        { id: BigInt("9007199254740993"), capteurId: "cap-1", grandeur: "temperature_air", valeur: 12, unite: "°C", mesureeA: new Date("2026-10-20T12:00:00Z") },
        { id: BigInt("9007199254740994"), capteurId: "cap-tiers", grandeur: "temperature_air", valeur: 30, unite: "°C" },
      ],
    }
    mocks.findMany.mockImplementation(async (name: string) => mocks.rows[name] ?? [])
    mocks.count.mockImplementation(async (name: string) => (mocks.rows[name] ?? []).length)
    mocks.createMany.mockImplementation(async (_name: string, { data }: { data: unknown[] }) => ({ count: data.length }))
    mocks.create.mockImplementation(async (name: string, { data }: { data: Record<string, unknown> }) => ({
      ...data, id: name === "mesureCapteur" ? BigInt(42) : data.id,
    }))
  })

  it("rend la sauvegarde JSON sérialisable sans perdre la précision ni exporter un capteur tiers", async () => {
    const sauvegarde = await exportAccount("source")
    const relecture = JSON.parse(JSON.stringify(sauvegarde))
    expect(relecture.data.MesureCapteur).toHaveLength(1)
    expect(relecture.data.MesureCapteur[0].id).toBe("9007199254740993")
    expect(relecture.data.MesureCapteur[0].mesureeA).toBe("2026-10-20T12:00:00.000Z")
    expect(mocks.findMany).toHaveBeenCalledWith("mesureCapteur", {
      where: {
        AND: [{ OR: [{ capteurId: { in: ["cap-1"] } }] }],
        OR: [{ capteurId: { in: ["cap-1"] } }],
      },
    })
    expect(sauvegarde.avertissements).toEqual([])
  })

  it("réimporte le fichier JSON et laisse la cible régénérer la PK BigInt", async () => {
    const sauvegarde = JSON.parse(JSON.stringify(await exportAccount("source")))
    const resultat = await importAccount("cible", sauvegarde)
    expect(resultat.imported.MesureCapteur).toBe(1)
    expect(resultat.skipped.MesureCapteur).toBeUndefined()
    const [creation] = mocks.createMany.mock.calls.find(([name]) => name === "mesureCapteur")![1].data
    expect(creation).not.toHaveProperty("id")
    expect(creation).toMatchObject({ capteurId: "cap-1", valeur: 12, mesureeA: new Date("2026-10-20T12:00:00Z") })
    expect(mocks.create.mock.calls.find(([name]) => name === "capteur")![1].data.userId).toBe("cible")
    expect(mocks.create.mock.calls.find(([name]) => name === "capteur")![1].data.clesRecues).toEqual(["TempC"])
  })

  it("accepte aussi un transfert direct non sérialisé", async () => {
    const resultat = await importAccount("cible", await exportAccount("source"))
    expect(resultat.imported.MesureCapteur).toBe(1)
  })

  it("refuse un entier JSON déjà arrondi au-delà de la précision JavaScript", async () => {
    const sauvegarde = await exportAccount("source")
    sauvegarde.data.MesureCapteur[0].id = Number("9007199254740993")
    await expect(importAccount("cible", sauvegarde)).rejects.toThrow("précision suffisante")
  })
})

describe("sauvegarde restaurable des capteurs (revue du 2026-10-30)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.rows = {
      connecteurCapteurs: [{ id: "conn-1", userId: "source", nom: "Banc", type: "generique", jetonHash: "empreinte", jetonPrefixe: "glc_essai", fuseau: "Pacific/Noumea" }],
      capteur: [{ id: "cap-1", userId: "source", connecteurId: "conn-1", identifiantExterne: "sonde" }],
      mesureCapteur: [{ id: BigInt(1), capteurId: "cap-1", grandeur: "temperature_air", valeur: 12, unite: "°C", mesureeA: new Date("2026-10-20T12:00:00Z") }],
      mesureCapteurJour: [{ id: 7, capteurId: "cap-1", grandeur: "temperature_air", jour: new Date("2026-07-01"), min: 1, max: 3, moyenne: 2, nombre: 96, unite: "°C" }],
    }
    mocks.findMany.mockImplementation(async (name: string) => mocks.rows[name] ?? [])
    mocks.count.mockImplementation(async (name: string) => (mocks.rows[name] ?? []).length)
    mocks.create.mockImplementation(async (_name: string, { data }: { data: Record<string, unknown> }) => ({ ...data, id: data.id ?? 1 }))
    mocks.createMany.mockImplementation(async (_name: string, { data }: { data: unknown[] }) => ({ count: data.length }))
  })

  it("au-delà du seuil, n'emporte pas le brut sans le charger, garde connecteurs, capteurs et agrégats, et le dit", async () => {
    mocks.count.mockImplementation(async (name: string) => (name === "mesureCapteur" ? SEUIL_MESURES_BRUTES_EXPORT + 1 : 0))
    const sauvegarde = await exportAccount("source")
    expect(mocks.count).toHaveBeenCalledWith("mesureCapteur", {
      where: { AND: [{ OR: [{ capteurId: { in: ["cap-1"] } }] }], OR: [{ capteurId: { in: ["cap-1"] } }] },
    })
    expect(mocks.findMany).not.toHaveBeenCalledWith("mesureCapteur", expect.anything())
    expect(sauvegarde.data.MesureCapteur).toEqual([])
    expect(sauvegarde.data.ConnecteurCapteurs).toHaveLength(1)
    expect(sauvegarde.data.Capteur).toHaveLength(1)
    expect(sauvegarde.data.MesureCapteurJour).toHaveLength(1)
    expect(sauvegarde.avertissements).toEqual([expect.stringMatching(/^Mesures brutes des capteurs non incluses .*agrégats journaliers/)])
  })

  it("au seuil exactement, le brut part comme avant", async () => {
    mocks.count.mockResolvedValue(SEUIL_MESURES_BRUTES_EXPORT)
    const sauvegarde = await exportAccount("source")
    expect(sauvegarde.data.MesureCapteur).toHaveLength(1)
    expect(sauvegarde.avertissements).toEqual([])
  })

  it("réimporte le brut par lots (createMany, doublons écartés), jamais ligne par ligne", async () => {
    const sauvegarde = JSON.parse(JSON.stringify(await exportAccount("source")))
    sauvegarde.data.MesureCapteur = Array.from({ length: 2500 }, (_, i) => ({
      id: String(i + 1), capteurId: "cap-1", grandeur: "temperature_air", valeur: i, unite: "°C",
      mesureeA: new Date(Date.UTC(2026, 9, 1) + i * 60_000).toISOString(),
    }))
    mocks.createMany.mockImplementationOnce(async (_name: string, { data }: { data: unknown[] }) => ({ count: data.length - 1 }))
    const resultat = await importAccount("cible", sauvegarde)
    const lots = mocks.createMany.mock.calls.filter(([name]) => name === "mesureCapteur").map(([, args]) => args)
    expect(lots.map((l) => l.data.length)).toEqual([1000, 1000, 500])
    expect(lots.every((l) => l.skipDuplicates === true)).toBe(true)
    expect(lots[0].data[0]).not.toHaveProperty("id")
    expect(lots[0].data[0]).toMatchObject({ capteurId: "cap-1", mesureeA: new Date(Date.UTC(2026, 9, 1)) })
    expect(mocks.create).not.toHaveBeenCalledWith("mesureCapteur", expect.anything())
    expect(resultat.imported.MesureCapteur).toBe(2499)
    expect(resultat.skipped.MesureCapteur).toBe(1)
  })

  it("remplace un fuseau importé hors de la liste fermée par le défaut du projet, et le dit", async () => {
    const sauvegarde = JSON.parse(JSON.stringify(await exportAccount("source")))
    sauvegarde.data.ConnecteurCapteurs[0].fuseau = "Mars/Olympus"
    const resultat = await importAccount("cible", sauvegarde)
    const creation = mocks.create.mock.calls.find(([name]) => name === "connecteurCapteurs")![1].data
    expect(creation.fuseau).toBe("Europe/Paris")
    expect(resultat.warnings).toContainEqual(expect.stringMatching(/« Banc » : fuseau « Mars\/Olympus » inconnu, remplacé par Europe\/Paris/))
  })

  it("garde un fuseau de la liste proposée, sans avertissement", async () => {
    const resultat = await importAccount("cible", JSON.parse(JSON.stringify(await exportAccount("source"))))
    expect(mocks.create.mock.calls.find(([name]) => name === "connecteurCapteurs")![1].data.fuseau).toBe("Pacific/Noumea")
    expect(resultat.warnings.filter((w) => w.includes("fuseau"))).toEqual([])
  })
})
