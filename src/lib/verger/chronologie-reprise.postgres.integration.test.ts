import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const auth = vi.hoisted(() => ({ id: "" }))
vi.mock("@/lib/auth-utils", () => ({
  requireAuthApi: async () => ({ error: null, session: { user: { id: auth.id } } }),
}))

import prisma from "@/lib/prisma"
import { POST } from "@/app/api/arbres/campagnes/[id]/observations/route"

const url = process.env.DATABASE_URL
const active = !!url && url === process.env.TEST_DATABASE_URL && new URL(url).pathname === "/gleba_tests"
const comptes: string[] = []
let campagneId: number
let refuserRecalcul = false
let etatPendantEchec: unknown
const ancienne = "2026-03-01T12:00:00.000Z"
const recente = "2026-06-01T12:00:00.000Z"
const poster = (date: string, tauxReprise?: number) => POST(
  { json: async () => ({ date, tauxReprise }) } as never,
  { params: Promise.resolve({ id: String(campagneId) }) },
)
const resume = () => prisma.campagnePlantation.findFirstOrThrow({
  where: { id: campagneId, userId: auth.id },
  select: { tauxReprise: true, dateDernObservation: true },
})

describe.skipIf(!active)("Chronologie de reprise sur PostgreSQL", () => {
  beforeAll(() => {
    prisma.$use(async (params, next) => {
      if (refuserRecalcul && params.model === "CampagnePlantation" && params.action === "update"
        && params.args.where.id === campagneId) {
        // Une autre connexion ne doit voir ni l'observation en cours ni son résumé.
        etatPendantEchec = {
          resume: await resume(),
          nombre: await prisma.observationCampagne.count({ where: { userId: auth.id, campagneId } }),
        }
        throw new Error("Échec fictif du recalcul")
      }
      return next(params)
    })
  })

  beforeEach(async () => {
    refuserRecalcul = false
    const compte = await prisma.user.create({ data: { email: `${randomUUID()}@example.invalid` } })
    comptes.push(compte.id)
    auth.id = compte.id
    const campagne = await prisma.campagnePlantation.create({ data: {
      userId: auth.id, nom: "Campagne fictive de chronologie", typeFormation: "verger",
      datePlantationReelle: new Date("2026-01-01"), nombrePlants: 100,
    } })
    campagneId = campagne.id
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: comptes } } })
    await prisma.$disconnect()
  })

  it("conserve le résumé récent après une saisie rétroactive et garde les deux observations", async () => {
    expect((await poster(recente, 80)).status).toBe(201)
    expect((await poster(ancienne, 60)).status).toBe(201)
    expect(await resume()).toEqual({ tauxReprise: 80, dateDernObservation: new Date(recente) })
    expect(await prisma.observationCampagne.count({ where: { userId: auth.id, campagneId } })).toBe(2)
  })

  it("conserve un zéro récent, même après un taux ancien et une observation sans taux plus récente", async () => {
    await poster(ancienne, 60)
    await poster(recente, 0)
    await poster(ancienne, 90)
    await poster("2026-07-01T12:00:00.000Z")
    expect(await resume()).toEqual({ tauxReprise: 0, dateDernObservation: new Date(recente) })
    expect(await prisma.observationCampagne.count({ where: { userId: auth.id, campagneId } })).toBe(4)
  })

  it("n'invente ni zéro ni date de reprise en l'absence de taux", async () => {
    const reponse = await poster(recente)
    expect(reponse.status).toBe(201)
    expect(await reponse.json()).toMatchObject({ tauxReprise: null })
    expect(await resume()).toEqual({ tauxReprise: null, dateDernObservation: null })
  })

  it("départage les dates égales par le dernier identifiant avec taux renseigné", async () => {
    const premier = await (await poster(recente, 85)).json()
    const dernier = await (await poster(recente, 0)).json()
    const sansTaux = await (await poster(recente)).json()
    expect(dernier.id).toBeGreaterThan(premier.id)
    expect(sansTaux.id).toBeGreaterThan(dernier.id)
    expect(await resume()).toEqual({ tauxReprise: 0, dateDernObservation: new Date(recente) })
  })

  it.each([false, true])("sérialise deux saisies concurrentes, récente en premier=%s", async (recentEnPremier) => {
    const saisies = recentEnPremier ? [[recente, 80], [ancienne, 60]] as const : [[ancienne, 60], [recente, 80]] as const
    const reponses = await Promise.all(saisies.map(([date, taux]) => poster(date, taux)))
    expect(reponses.map((r) => r.status)).toEqual([201, 201])
    expect(await resume()).toEqual({ tauxReprise: 80, dateDernObservation: new Date(recente) })
    expect(await prisma.observationCampagne.count({ where: { userId: auth.id, campagneId } })).toBe(2)
  })

  it("annule la création si le recalcul échoue et ne publie aucun état intermédiaire", async () => {
    await poster(ancienne, 60)
    refuserRecalcul = true
    try {
      await expect(poster(recente, 80)).rejects.toThrow("Échec fictif du recalcul")
    } finally {
      refuserRecalcul = false
    }
    const attendu = { resume: { tauxReprise: 60, dateDernObservation: new Date(ancienne) }, nombre: 1 }
    expect(etatPendantEchec).toEqual(attendu)
    expect(await resume()).toEqual(attendu.resume)
    expect(await prisma.observationCampagne.count({ where: { userId: auth.id, campagneId } })).toBe(1)
  })
})
