import { describe, expect, it, vi } from "vitest"
import { checkAdjacence } from "@/lib/associations-adjacence"

describe("checkAdjacence", () => {
  it("distingue une planche sans îlot d'un îlot sans autre planche", async () => {
    const sansIlot = {
      planche: {
        findFirst: vi.fn().mockResolvedValue({ id: "p1", nom: "P1", ilot: null }),
        findMany: vi.fn(),
      },
    }
    await expect(checkAdjacence("tomate", "p1", "u1", sansIlot as never))
      .resolves.toEqual({
        alertes: [],
        suggestions: [],
        ilot: null,
        planchesVoisines: [],
      })
    expect(sansIlot.planche.findMany).not.toHaveBeenCalled()

    const ilotSansVoisine = {
      planche: {
        findFirst: vi.fn().mockResolvedValue({
          id: "p1",
          nom: "P1",
          ilot: "Jardin test Codex",
        }),
        findMany: vi.fn().mockResolvedValue([]),
      },
    }
    await expect(checkAdjacence("tomate", "p1", "u1", ilotSansVoisine as never))
      .resolves.toEqual({
        alertes: [],
        suggestions: [],
        ilot: "Jardin test Codex",
        planchesVoisines: [],
      })
  })
})
