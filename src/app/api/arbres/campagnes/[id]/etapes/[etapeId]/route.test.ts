import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Revue Codex du 2026-11-12, COM-05. Cocher ou décocher l'étape Plantation
 * change `datePlantationReelle` de la campagne, mais ne régénérait pas le
 * miroir comptable de son coût : la dépense restait datée de l'ancienne date
 * (prévue ou création) dans le FEC et les indicateurs, parfois sur un autre
 * exercice que la plantation réelle.
 */
const m = vi.hoisted(() => {
  const ordre: string[] = []
  const campagne = { id: 17, nom: "Haie", coutReel: 110, statut: "planifiee", datePlantationPrevue: new Date("2025-11-01T00:00:00Z"), datePlantationReelle: null as Date | null, createdAt: new Date("2025-05-01T00:00:00Z") }
  const etape = { id: 29, userId: "u1", campagneId: 17, type: "plantation", fait: false, dateRealisation: null as Date | null }
  const tx = {
    $queryRaw: vi.fn(async () => []),
    etapeCampagne: {
      findFirst: vi.fn(async () => ({ ...etape })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { for (const [k, v] of Object.entries(data)) if (v !== undefined) (etape as Record<string, unknown>)[k] = v; return { ...etape } }),
    },
    campagnePlantation: {
      findFirst: vi.fn(async () => ({ ...campagne })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { Object.assign(campagne, data); ordre.push("campagne"); return { ...campagne } }),
    },
  }
  return { ordre, campagne, etape, tx, createDepense: vi.fn(async () => { ordre.push("miroir") }), invalidateKpi: vi.fn(() => { ordre.push("kpi") }), verrou: vi.fn(async () => { ordre.push("verrou") }) }
})
vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: vi.fn(async () => ({ error: null, session: { user: { id: "u1" } } })) }))
vi.mock("@/lib/prisma", () => ({ default: { ...m.tx, $transaction: async (fn: (t: typeof m.tx) => unknown) => fn(m.tx) } }))
vi.mock("@/lib/auto-compta", () => ({ createDepenseFromCampagnePlantation: m.createDepense }))
vi.mock("@/lib/kpi/cache", () => ({ invalidateKpi: m.invalidateKpi }))
vi.mock("@/lib/comptabilite/verrou-reglements", () => ({ verrouillerReglements: m.verrou }))

import { PUT } from "./route"

const put = (body: unknown) => PUT({ json: async () => body } as never, { params: Promise.resolve({ id: "17", etapeId: "29" }) })

describe("PUT étape Plantation d'une campagne", () => {
  beforeEach(() => {
    vi.clearAllMocks(); m.ordre.length = 0
    Object.assign(m.campagne, { statut: "planifiee", datePlantationReelle: null })
    Object.assign(m.etape, { type: "plantation", fait: false, dateRealisation: null })
  })
  afterEach(() => vi.useRealTimers())

  it("cocher sans date puis décocher retire les deux dates réelles", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-11-18T12:34:56.789Z"))
    const cochee = await put({ fait: true })
    expect(await cochee.json()).toMatchObject({ fait: true, dateRealisation: "2026-11-18T12:34:56.789Z" })
    expect(m.etape.dateRealisation).toEqual(m.campagne.datePlantationReelle)
    expect(m.campagne.statut).toBe("plantation")
    await put({ fait: false })
    expect(m.etape.dateRealisation).toBeNull()
    expect(m.campagne.datePlantationReelle).toBeNull()
    expect(m.campagne.statut).toBe("planifiee")
  })

  it("rejouer un cochage sans date conserve sa date et son miroir", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-11-18T12:34:56.789Z"))
    await put({ fait: true })
    const date = m.campagne.datePlantationReelle
    vi.setSystemTime(new Date("2026-11-19T12:34:56.789Z"))
    await put({ fait: true })
    expect(m.etape.dateRealisation).toEqual(date)
    expect(m.campagne.datePlantationReelle).toEqual(date)
    expect(m.createDepense).toHaveBeenCalledOnce()
    await put({ fait: false })
    await put({ fait: false })
    expect(m.createDepense).toHaveBeenCalledTimes(2)
  })

  it("conserve une date explicite déjà saisie lors du cochage", async () => {
    const date = new Date("2026-01-02T09:10:11.123Z")
    m.etape.dateRealisation = date
    await put({ fait: true })
    expect(m.etape.dateRealisation).toEqual(date)
    expect(m.campagne.datePlantationReelle).toEqual(date)
  })

  it("ne retire pas une date de campagne indépendante au décochage", async () => {
    const date = new Date("2026-02-03T12:00:00Z")
    Object.assign(m.campagne, { datePlantationReelle: date, statut: "suivi" })
    Object.assign(m.etape, { fait: true, dateRealisation: new Date("2026-01-02T12:00:00Z") })
    await put({ fait: false })
    expect(m.campagne.datePlantationReelle).toEqual(date)
    expect(m.campagne.statut).toBe("suivi")
    expect(m.etape.dateRealisation).toBeNull()
    expect(m.createDepense).not.toHaveBeenCalled()
  })

  it.each(["terminee", "echec"])("préserve le statut terminal %s au cochage et au décochage", async (statut) => {
    m.campagne.statut = statut
    await put({ fait: true })
    expect(m.campagne.statut).toBe(statut)
    await put({ fait: false })
    expect(m.campagne.statut).toBe(statut)
    expect(m.campagne.datePlantationReelle).toBeNull()
  })

  it("cocher la plantation date le miroir de la dépense à la plantation réelle, sous le verrou, puis invalide les indicateurs", async () => {
    const res = await put({ fait: true, dateRealisation: "2026-11-12T12:00:00Z" })
    expect(res.status).toBe(200)
    expect(m.createDepense).toHaveBeenCalledOnce()
    const [userId, source, tx] = m.createDepense.mock.calls[0] as unknown as [string, { datePlantationReelle: Date; coutReel: number }, unknown]
    expect(userId).toBe("u1")
    expect(source.datePlantationReelle.toISOString()).toBe("2026-11-12T12:00:00.000Z")
    expect(source.coutReel).toBe(110)
    expect(tx).toBe(m.tx)
    expect(m.ordre).toEqual(["verrou", "campagne", "miroir", "kpi"])
  })

  it("décocher la plantation ramène le miroir à la date prévue", async () => {
    const date = new Date("2026-11-12T12:00:00Z")
    Object.assign(m.etape, { fait: true, dateRealisation: date })
    Object.assign(m.campagne, { statut: "plantation", datePlantationReelle: date })
    await put({ fait: false })
    expect(m.createDepense).toHaveBeenCalledOnce()
    const [, source] = m.createDepense.mock.calls[0] as unknown as [string, { datePlantationReelle: Date | null; datePlantationPrevue: Date }]
    expect(source.datePlantationReelle).toBeNull()
    expect(source.datePlantationPrevue.toISOString()).toBe("2025-11-01T00:00:00.000Z")
    expect(m.invalidateKpi).toHaveBeenCalledWith("u1")
  })

  it("une autre étape ne touche ni la campagne ni la comptabilité", async () => {
    Object.assign(m.etape, { type: "taille" })
    await put({ fait: true })
    expect(m.createDepense).not.toHaveBeenCalled()
    expect(m.invalidateKpi).not.toHaveBeenCalled()
  })
})
