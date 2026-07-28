import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  reservationFindFirst: vi.fn(),
  exploitationFindUnique: vi.fn(),
  naissanceFindFirst: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: {
    reservationElevage: { findFirst: mocks.reservationFindFirst },
    exploitation: { findUnique: mocks.exploitationFindUnique },
    naissanceAnimale: { findFirst: mocks.naissanceFindFirst },
  },
}))

import { GET } from "./route"

describe("projets de documents de réservation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: "user-1" } },
    })
    mocks.reservationFindFirst.mockResolvedValue({
      id: "resa-1",
      userId: "user-1",
      acquereurNom: "Camille Test",
      acquereurEmail: "camille@example.test",
      acquereurTel: null,
      naissanceId: null,
      petitNaissanceId: null,
      statut: "attente",
      acompte: 100,
      montant: 800,
      dateReservation: new Date("2026-07-20T00:00:00.000Z"),
      dateLivraison: null,
      notes: null,
    })
    mocks.exploitationFindUnique.mockResolvedValue(null)
    mocks.naissanceFindFirst.mockResolvedValue(null)
  })

  it.each(["contrat", "engagement", "attestation"])(
    "génère le projet %s avec un avertissement préparatoire",
    async (type) => {
      const response = await GET(
        new NextRequest(
          `http://localhost/api/elevage/reservations/resa-1/document?type=${type}`,
        ),
        { params: Promise.resolve({ id: "resa-1" }) },
      )
      const bytes = new Uint8Array(await response.arrayBuffer())

      expect(response.status).toBe(200)
      expect(response.headers.get("content-type")).toBe("application/pdf")
      expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("%PDF")
      expect(mocks.reservationFindFirst).toHaveBeenCalledWith({
        where: { id: "resa-1", userId: "user-1" },
      })
    },
  )

  it("rejette un type inconnu avant la lecture de la réservation", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost/api/elevage/reservations/resa-1/document?type=officiel",
      ),
      { params: Promise.resolve({ id: "resa-1" }) },
    )

    expect(response.status).toBe(400)
    expect(mocks.reservationFindFirst).not.toHaveBeenCalled()
  })
})
