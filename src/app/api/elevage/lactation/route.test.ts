import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({ auth: vi.fn(), animal: vi.fn(), collectes: vi.fn() }))
vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.auth }))
vi.mock("@/lib/prisma", () => ({ default: {
  animal: { findFirst: mocks.animal }, collecteLait: { findMany: mocks.collectes },
} }))

import { GET } from "./route"

const maintenant = new Date("2026-11-18T12:00:00Z")
const avant = (jours: number) => new Date(maintenant.getTime() - jours * 86_400_000)
const animal = (jours?: number, lactationLongue = false) => ({
  id: 42, nom: "Laitière fictive", identifiant: null, lactationLongue,
  naissancesMere: jours === undefined ? [] : [{ date: avant(jours) }],
})
const collecte = (jours: number, litres = "2") => ({ date: avant(jours), quantiteLitres: litres })
const lire = () => GET(new NextRequest("http://localhost/api/elevage/lactation?animalId=42"))

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(maintenant)
  vi.resetAllMocks()
  mocks.auth.mockResolvedValue({ session: { user: { id: "ferme-fictive" } }, error: null })
  mocks.animal.mockResolvedValue(animal())
  mocks.collectes.mockResolvedValue([])
})
afterEach(() => vi.useRealTimers())

describe("GET lactation : provenance de l’âge et tarissement", () => {
  it("conserve la courbe depuis la mise-bas et la moyenne des jours mesurés", async () => {
    mocks.animal.mockResolvedValue(animal(4))
    mocks.collectes.mockResolvedValue([collecte(4, "2"), collecte(4, "1"), collecte(2, "6"), collecte(0, "3")])
    const reponse = await lire()
    expect(reponse.status).toBe(200)
    expect(await reponse.json()).toMatchObject({
      animal: { id: 42, nom: "Laitière fictive", identifiant: null },
      dateOrigine: avant(4).toISOString(), dim: 4, origineLactation: "mise_bas", dimEstime: false,
      moyenne7j: 4, joursMesures: 3, lactationLongue: false, suggererTarissement: false,
      courbe: [
        { dim: 0, volume: 3, moyenne7j: 3 }, { dim: 1, volume: 0, moyenne7j: 1.5 },
        { dim: 2, volume: 6, moyenne7j: 3 }, { dim: 3, volume: 0, moyenne7j: 2.25 },
        { dim: 4, volume: 3, moyenne7j: 2.4 },
      ],
    })
    expect(mocks.animal).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 42, userId: "ferme-fictive" } }))
    expect(mocks.collectes).toHaveBeenCalledWith({
      where: { animalId: 42, userId: "ferme-fictive", date: { gte: avant(4), lte: expect.any(Date) } },
      orderBy: { date: "asc" }, select: { date: true, quantiteLitres: true },
    })
  })

  it.each([
    { jours: 60, litres: "0.3", mesures: 3, longue: false, suggestion: false },
    { jours: 61, litres: "0.3", mesures: 3, longue: false, suggestion: true },
    { jours: 61, litres: "0.3", mesures: 2, longue: false, suggestion: false },
    { jours: 61, litres: "0.5", mesures: 3, longue: false, suggestion: false },
    { jours: 270, litres: "2", mesures: 3, longue: false, suggestion: false },
    { jours: 271, litres: "2", mesures: 0, longue: false, suggestion: true },
    { jours: 300, litres: "0.3", mesures: 3, longue: true, suggestion: false },
  ])("mise-bas connue : règles conservées ($jours j, $mesures mesures, longue=$longue)", async (cas) => {
    mocks.animal.mockResolvedValue(animal(cas.jours, cas.longue))
    mocks.collectes.mockResolvedValue(Array.from({ length: cas.mesures }, (_, i) => collecte(cas.mesures - i - 1, cas.litres)))
    expect(await (await lire()).json()).toMatchObject({
      dim: cas.jours, origineLactation: "mise_bas", dimEstime: false, suggererTarissement: cas.suggestion,
    })
  })

  it.each([100, 300])("collectes seules depuis %i jours : estimation explicite sans suggestion, même à faible production", async (jours) => {
    mocks.collectes.mockResolvedValue([collecte(jours), collecte(2, "0.2"), collecte(1, "0.3"), collecte(0, "0.4")])
    const resultat = await (await lire()).json()
    expect(resultat).toMatchObject({
      dateOrigine: avant(jours).toISOString(), dim: jours,
      origineLactation: "premiere_collecte", dimEstime: true, suggererTarissement: false,
      moyenne7j: 0.3, joursMesures: 3,
    })
    expect(resultat.courbe).toHaveLength(jours + 1)
    expect(resultat.courbe[0]).toMatchObject({ dim: 0, volume: 2 })
    expect(mocks.collectes.mock.calls[0][0].where.date.gte).toEqual(avant(305))
  })

  it("sans mise-bas ni collecte : aucune date ni aucun âge inventés", async () => {
    expect(await (await lire()).json()).toEqual({
      animal: { id: 42, nom: "Laitière fictive", identifiant: null },
      courbe: [], dim: null, origineLactation: "inconnue", dimEstime: false,
      lactationLongue: false, suggererTarissement: false,
    })
  })

  it("conserve le 400 sans identifiant et le 404 sans animal accessible", async () => {
    expect((await GET(new NextRequest("http://localhost/api/elevage/lactation"))).status).toBe(400)
    expect(mocks.animal).not.toHaveBeenCalled()
    mocks.animal.mockResolvedValue(null)
    expect((await lire()).status).toBe(404)
    expect(mocks.collectes).not.toHaveBeenCalled()
  })
})
