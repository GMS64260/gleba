/** Base gleba_tests uniquement ; écritures réelles, aucun téléchargement SAFRAN. */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import prisma from "@/lib/prisma"
import { historiqueDuPoint } from "./historique"

const url = process.env.DATABASE_URL
const active = !!url && url === process.env.TEST_DATABASE_URL && new URL(url).pathname === "/gleba_tests"
const point = [43.3, -0.37] as const
const coordonnees = { lambx: 3800, lamby: 18170 }
const cle = { lambx_lamby: coordonnees }
const ids: number[] = []
let apresLecture: (() => Promise<void>) | undefined
let nettoyer = false

/** La barrière se place après les vrais SELECT PostgreSQL, avant les écritures. */
function synchroniserLectures(entreLectureEtInsertion?: () => Promise<void>) {
  let lectures = 0
  let liberer!: () => void
  const barriere = new Promise<void>((resolve) => { liberer = resolve })
  apresLecture = async () => {
    if (++lectures === 2) {
      await entreLectureEtInsertion?.()
      liberer()
    }
    await barriere
  }
}

describe.runIf(active)("premières lectures du gel sur PostgreSQL", () => {
  beforeAll(() => {
    prisma.$use(async (params, next) => {
      const resultat = await next(params)
      if (params.model === "ClimatMaille" && params.action === "findUnique"
        && params.args.where.lambx_lamby?.lambx === coordonnees.lambx
        && params.args.where.lambx_lamby?.lamby === coordonnees.lamby && apresLecture) {
        expect(resultat).toBeNull()
        await apresLecture()
      }
      return resultat
    })
  })

  beforeEach(async () => {
    vi.stubEnv("GLEBA_AGROCLIMAT_IMPORT", "false")
    apresLecture = undefined
    nettoyer = false
    // Ne jamais effacer une maille préexistante, même dans la base jetable.
    expect(await prisma.climatMaille.findUnique({ where: cle })).toBeNull()
    nettoyer = true
  })

  afterEach(async () => {
    apresLecture = undefined
    if (nettoyer) {
      const synthetiques = await prisma.climatMaille.findMany({ where: coordonnees, select: { id: true } })
      ids.push(...synthetiques.map((m) => m.id))
      await prisma.climatMaille.deleteMany({ where: { id: { in: ids } } })
    }
    vi.unstubAllEnvs()
  })
  afterAll(async () => { await prisma.$disconnect() })

  it("termine deux demandes concurrentes et conserve une seule ligne", async () => {
    synchroniserLectures()
    const resultats = await Promise.all([historiqueDuPoint(...point), historiqueDuPoint(...point)])
    apresLecture = undefined
    expect(resultats.map((r) => r.etat)).toEqual(["en_preparation", "en_preparation"])
    const mailles = await prisma.climatMaille.findMany({ where: coordonnees })
    expect(mailles).toHaveLength(1)
    expect(mailles[0]).toMatchObject({ ...coordonnees, etat: "demandee", tentatives: 0, verrouJeton: null, actualiseeLe: null })
  })

  it.each(["demandee", "prete", "echec"])("préserve la maille %s créée entre lecture et insertion", async (etat) => {
    let avant: unknown
    synchroniserLectures(async () => {
      const maille = await prisma.climatMaille.create({ data: {
        ...coordonnees, etat, tentatives: 3, erreur: "Erreur synthétique conservée",
        verrouJeton: "bail-synthetique", verrouJusqua: new Date("2099-01-01T00:00:00Z"), actualiseeLe: null,
        annees: { create: { annee: 2025, tmin: Array(366).fill(-10), tmax: Array(366).fill(120) } },
      } })
      ids.push(maille.id)
      avant = await prisma.climatMaille.findFirstOrThrow({ where: { id: maille.id }, include: { annees: true } })
    })
    expect((await Promise.all([historiqueDuPoint(...point), historiqueDuPoint(...point)])).map((r) => r.etat))
      .toEqual(["en_preparation", "en_preparation"])
    apresLecture = undefined
    expect(await prisma.climatMaille.findUnique({ where: cle, include: { annees: true } })).toEqual(avant)
    const relue = await historiqueDuPoint(...point)
    expect(relue.etat).toBe(etat === "prete" ? "pret" : etat === "echec" ? "indisponible" : "en_preparation")
    if (relue.etat === "pret") {
      expect(relue.actualiseLe).toBeNull()
      expect(relue.annees).toEqual([{ annee: 2025, tmin: Array(366).fill(-1), tmax: Array(366).fill(12) }])
    }
    expect(await prisma.climatMaille.count({ where: coordonnees })).toBe(1)
  })
})
