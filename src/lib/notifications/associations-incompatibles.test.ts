import { beforeEach, describe, expect, it, vi } from "vitest"

const db = vi.hoisted(() => ({
  planche: { findMany: vi.fn() },
  association: { findMany: vi.fn() },
  espece: { findMany: vi.fn() },
}))
vi.mock("@/lib/prisma", () => ({ default: db, prisma: db }))

import { detecterAssociationsIncompatibles } from "./queries"

const MAINTENANT = new Date(2026, 5, 15, 12)

const culture = (especeId: string, extra: Record<string, unknown> = {}) => ({
  especeId,
  annee: 2026,
  terminee: null,
  semisFait: null,
  plantationFaite: true,
  recolteFaite: false,
  dateSemis: null,
  datePlantation: new Date(2026, 3, 1),
  dateRecolte: new Date(2026, 6, 1),
  finRecolte: new Date(2026, 7, 1),
  espece: { vivace: false },
  ...extra,
})

const ailContre = {
  id: "ail-contre",
  nom: "Ail !",
  type: "incompatible",
  description: null,
  notes: null,
  details: [
    { especeId: "Ail", requise: true, espece: { nom: "Ail" } },
    { especeId: "Haricot", requise: false, espece: { nom: "Haricot" } },
  ],
}

describe("detecterAssociationsIncompatibles", () => {
  beforeEach(() => {
    db.planche.findMany.mockReset()
    db.association.findMany.mockReset()
    db.espece.findMany.mockReset()
    db.association.findMany.mockResolvedValue([ailContre])
    db.espece.findMany.mockResolvedValue([])
  })

  it("lit les règles une seule fois pour toutes les planches, bornées à l'exploitation", async () => {
    db.planche.findMany.mockResolvedValue([
      { id: "p1", nom: "P1", cultures: [culture("Ail"), culture("Haricot")] },
      { id: "p2", nom: "P2", cultures: [culture("Ail"), culture("Haricot")] },
    ])
    const res = await detecterAssociationsIncompatibles("exploitation-1", MAINTENANT)
    expect(db.planche.findMany.mock.calls[0][0].where).toEqual({ userId: "exploitation-1" })
    expect(db.association.findMany).toHaveBeenCalledTimes(1)
    expect(res.map((a) => a.key)).toEqual([
      "association-incompatible:p1:ail-haricot",
      "association-incompatible:p2:ail-haricot",
    ])
  })

  it("garde une culture en cours de récolte, écarte une campagne ancienne jamais close", async () => {
    db.planche.findMany.mockResolvedValue([
      // En récolte : `recolteFaite: true`, fenêtre encore ouverte.
      { id: "p1", nom: "P1", cultures: [culture("Ail", { recolteFaite: true }), culture("Haricot")] },
      // 2024, récoltée de fait, jamais close.
      {
        id: "p2",
        nom: "P2",
        cultures: [
          culture("Ail", {
            annee: 2024,
            datePlantation: new Date(2023, 9, 15),
            dateRecolte: new Date(2024, 5, 20),
            finRecolte: new Date(2024, 6, 1),
          }),
          culture("Haricot"),
        ],
      },
    ])
    const res = await detecterAssociationsIncompatibles("exploitation-1", MAINTENANT)
    expect(res.map((a) => a.key)).toEqual(["association-incompatible:p1:ail-haricot"])
  })

  it("ne lit pas les règles quand aucune planche ne porte deux espèces en place", async () => {
    db.planche.findMany.mockResolvedValue([{ id: "p1", nom: "P1", cultures: [culture("Ail")] }])
    await expect(detecterAssociationsIncompatibles("exploitation-1", MAINTENANT)).resolves.toEqual([])
    expect(db.association.findMany).not.toHaveBeenCalled()
  })
})
