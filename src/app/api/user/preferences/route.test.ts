/**
 * PUT /api/user/preferences — le compte de démonstration est figé.
 *
 * Régression couverte (2026-09-09) : la démo est un compte PARTAGÉ, et les
 * préférences d'un visiteur devenaient le décor du suivant. Mesuré sur cinq
 * jours d'usage : un visiteur a activé le briefing automatique le 06/09 à
 * 11:36:00 (un briefing généré à chaque visite ensuite, pour des prospects qui
 * n'avaient rien demandé), un autre a changé `modulesActifs` le 05/09, et
 * `notifPrefs` s'est retrouvé tout à `true` — ce qui a mis les 7 parcelles de
 * la démo dans le scan météo périodique et pesé sur Open-Meteo.
 *
 * Le refus doit être EXPLICITE (403 avec message lisible) et non un silence :
 * un no-op laisserait le visiteur croire son réglage enregistré.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  userFindUnique: vi.fn(),
  prefFindMany: vi.fn(),
  prefUpsert: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: {
    user: { findUnique: mocks.userFindUnique },
    userPreference: { findMany: mocks.prefFindMany, upsert: mocks.prefUpsert },
    $transaction: mocks.transaction,
  },
}))

import { PUT } from "./route"

function requete(body: unknown): Request {
  return new Request("http://localhost/api/user/preferences", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue({
    error: null,
    session: { user: { id: "u1", role: "USER" } },
  })
  mocks.transaction.mockResolvedValue([])
  mocks.prefFindMany.mockResolvedValue([])
})

describe("PUT /api/user/preferences — compte de démonstration", () => {
  it("refuse en 403 et n'écrit RIEN", async () => {
    mocks.userFindUnique.mockResolvedValue({ email: "demo@gleba.fr" })

    const res = await PUT(requete({ briefingQuotidienAuto: true }) as never)

    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toContain("compte de démonstration est partagé")
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.prefUpsert).not.toHaveBeenCalled()
  })

  it("refuse quelle que soit la casse de l'adresse", async () => {
    mocks.userFindUnique.mockResolvedValue({ email: "Demo@Gleba.FR" })

    const res = await PUT(requete({ modulesActifs: ["maraichage"] }) as never)

    expect(res.status).toBe(403)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
})

describe("PUT /api/user/preferences — compte réel", () => {
  it("écrit normalement", async () => {
    mocks.userFindUnique.mockResolvedValue({ email: "maraicher@example.com" })
    mocks.prefFindMany.mockResolvedValue([{ key: "modulesActifs", value: '["maraichage"]' }])

    const res = await PUT(requete({ modulesActifs: ["maraichage"] }) as never)

    expect(res.status).toBe(200)
    expect(mocks.transaction).toHaveBeenCalledTimes(1)
    await expect(res.json()).resolves.toEqual({ modulesActifs: ["maraichage"] })
  })

  it("écrit encore quand le compte n'est pas retrouvé (ne bloque pas sur un cas limite)", async () => {
    mocks.userFindUnique.mockResolvedValue(null)

    const res = await PUT(requete({ theme: "sombre" }) as never)

    expect(res.status).toBe(200)
    expect(mocks.transaction).toHaveBeenCalledTimes(1)
  })
})
