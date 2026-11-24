import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextResponse } from "next/server"

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  campagne: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  lister: vi.fn(),
  verrou: vi.fn(),
  historique: [] as { id: number; date: Date; tauxReprise: number | null }[],
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.auth }))
vi.mock("@/lib/prisma", () => {
  const db = {
    campagnePlantation: { findFirst: mocks.campagne, update: mocks.update },
    observationCampagne: { create: mocks.create, findMany: mocks.lister },
    $queryRaw: mocks.verrou,
  }
  return { default: { ...db, $transaction: async (action: (tx: typeof db) => Promise<unknown>) => action(db) } }
})

import { POST } from "./route"

const post = (body: Record<string, unknown>) => POST(
  { json: async () => body } as never,
  { params: Promise.resolve({ id: "17" }) },
)
const champs = ["nbVivants", "nbMorts", "nbManquants", "tauxReprise", "hauteurMoyenneCm"]

beforeEach(() => {
  vi.resetAllMocks()
  mocks.historique.length = 0
  mocks.auth.mockResolvedValue({ error: null, session: { user: { id: "ferme-test" } } })
  mocks.campagne.mockResolvedValue({ id: 17, nombrePlants: 100, statut: "plantation", datePlantationReelle: new Date("2026-01-15") })
  mocks.verrou.mockResolvedValue([{ id: 17 }])
  mocks.lister.mockImplementation(async () => mocks.historique)
  mocks.create.mockImplementation(async ({ data }) => {
    const observation = { id: 29 + mocks.historique.length, ...data }
    mocks.historique.push(observation)
    return observation
  })
})

describe("POST observation de campagne — valeurs numériques", () => {
  it.each([0, "0"])("conserve la mortalité complète avec nbVivants=%j sur 100 plants", async (nbVivants) => {
    const res = await post({ nbVivants, nbMorts: 100 })
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ nbVivants: 0, nbMorts: 100, tauxReprise: 0 })
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tauxReprise: 0 }) }))
  })

  it.each([0, "0"])("préserve tous les zéros explicites %j, même face à un taux calculable", async (zero) => {
    const res = await post(Object.fromEntries(champs.map((champ) => [champ, zero])))
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject(Object.fromEntries(champs.map((champ) => [champ, 0])))
    const explicite = await post({ nbVivants: 80, tauxReprise: zero })
    expect(await explicite.json()).toMatchObject({ nbVivants: 80, tauxReprise: 0 })
  })

  it.each([undefined, null, "", "   "])("garde les champs facultatifs vides (%j) à null", async (vide) => {
    const res = await post(vide === undefined ? {} : Object.fromEntries(champs.map((champ) => [champ, vide])))
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject(Object.fromEntries(champs.map((champ) => [champ, null])))
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 17, userId: "ferme-test" },
      data: { tauxReprise: null, dateDernObservation: null },
    })
  })

  it("calcule le taux à partir des plants plantés et conserve les décimales", async () => {
    const res = await post({ nbVivants: "75", nbMorts: "5", hauteurMoyenneCm: "12.5" })
    expect(await res.json()).toMatchObject({ nbVivants: 75, nbMorts: 5, nbManquants: null, tauxReprise: 75, hauteurMoyenneCm: 12.5 })
  })

  // D44 (2026-11-24) : 125 vivants sur 100 plants donnaient 125 % de reprise.
  it("refuse plus de plants vivants que de plants plantés", async () => {
    const res = await post({ nbVivants: "125" })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ champ: "nbVivants" })
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
    expect((await post({ nbVivants: "100" })).status).toBe(201)
  })

  it("conserve le calcul de repli sans nombre de plants renseigné", async () => {
    mocks.campagne.mockResolvedValue({ id: 17, nombrePlants: null, datePlantationReelle: new Date("2026-01-15") })
    const res = await post({ nbVivants: "0", nbMorts: "100" })
    expect(await res.json()).toMatchObject({ nbVivants: 0, tauxReprise: 0 })
  })

  const invalides = [
    ...champs.flatMap((champ) => [NaN, Infinity, -Infinity, "NaN", "Infinity", "-Infinity", "1e309", "12plants", false, [], {}].map((valeur) => ({ champ, valeur }))),
    ...["nbVivants", "nbMorts", "nbManquants"].flatMap((champ) => [-1, "-1", 0.5, "0.5", "1.9", 2147483648, "2147483648"].map((valeur) => ({ champ, valeur }))),
    ...[-0.1, "-0.1", 100.1, "100.1"].map((valeur) => ({ champ: "tauxReprise", valeur })),
  ]
  it.each(invalides)("refuse $champ=$valeur sans écriture", async ({ champ, valeur }) => {
    const res = await post({ nbVivants: 80, [champ]: valeur })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: expect.any(String), champ })
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it.each([0, 100, "0", "100", "25.5"])("accepte le taux borné %j", async (tauxReprise) => {
    const res = await post({ tauxReprise })
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ tauxReprise: Number(tauxReprise), nbVivants: null })
  })

  it("garde le filtre propriétaire et le 404 d'une campagne étrangère", async () => {
    mocks.campagne.mockResolvedValue(null)
    const res = await post({ nbVivants: 0 })
    expect(res.status).toBe(404)
    expect(mocks.campagne).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 17, userId: "ferme-test" } }))
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it("conserve le refus d'autorisation et le préalable de plantation", async () => {
    mocks.auth.mockResolvedValueOnce({ error: NextResponse.json({ error: "Accès refusé" }, { status: 403 }) })
    expect((await post({ nbVivants: 0 })).status).toBe(403)
    expect(mocks.campagne).not.toHaveBeenCalled()
    mocks.campagne.mockResolvedValue({ id: 17, nombrePlants: 100, datePlantationReelle: null })
    expect((await post({ nbVivants: 0 })).status).toBe(400)
    expect(mocks.create).not.toHaveBeenCalled()
  })
})
