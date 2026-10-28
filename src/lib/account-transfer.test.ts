import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  rows: {} as Record<string, Array<Record<string, unknown>>>,
  create: vi.fn(),
  findMany: vi.fn(),
}))

vi.mock("@/lib/prisma", () => {
  const client: object = new Proxy({}, {
    get: (_target, name: string) => {
      if (name === "$transaction") return (action: (tx: object) => Promise<unknown>) => action(client)
      if (name === "$executeRawUnsafe") return async () => 0
      return {
        findMany: (args: unknown) => mocks.findMany(name, args),
        create: (args: { data: Record<string, unknown> }) => mocks.create(name, args),
      }
    },
  })
  return { default: client }
})

import { exportAccount, importAccount } from "./account-transfer"

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
  })

  it("réimporte le fichier JSON et laisse la cible régénérer la PK BigInt", async () => {
    const sauvegarde = JSON.parse(JSON.stringify(await exportAccount("source")))
    const resultat = await importAccount("cible", sauvegarde)
    expect(resultat.imported.MesureCapteur).toBe(1)
    expect(resultat.skipped.MesureCapteur).toBeUndefined()
    const creation = mocks.create.mock.calls.find(([name]) => name === "mesureCapteur")![1].data
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
