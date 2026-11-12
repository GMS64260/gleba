import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ auth: vi.fn(), update: vi.fn() }))
vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.auth }))
vi.mock("@/lib/prisma", () => ({ default: { evolution: { update: mocks.update } } }))
import { PATCH } from "./route"

const patcher = () =>
  PATCH(
    new Request("https://gleba.example/api/evolutions/evo-qa", { method: "PATCH", body: JSON.stringify({ statut: "PLANIFIEE" }) }),
    { params: Promise.resolve({ id: "evo-qa" }) },
  )

describe("PATCH /api/evolutions/[id] : trace des pannes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ error: null, session: { user: { id: "admin-qa", role: "ADMIN" } } })
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("une demande introuvable (P2025) répond 404 sans journaliser", async () => {
    const journal = vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.update.mockRejectedValue(Object.assign(new Error("Record to update not found."), { code: "P2025" }))
    const reponse = await patcher()
    expect(reponse.status).toBe(404)
    expect(await reponse.json()).toEqual({ error: "Demande introuvable" })
    expect(journal).not.toHaveBeenCalled()
  })

  it("une panne de base garde le 404 mais laisse une trace attribuée à la route", async () => {
    const journal = vi.spyOn(console, "error").mockImplementation(() => {})
    const panne = Object.assign(new Error("Can't reach database server"), { code: "P1001" })
    mocks.update.mockRejectedValue(panne)
    const reponse = await patcher()
    expect(reponse.status).toBe(404)
    expect(await reponse.json()).toEqual({ error: "Demande introuvable" })
    expect(journal).toHaveBeenCalledWith("PATCH /api/evolutions/[id] error:", panne)
  })
})
