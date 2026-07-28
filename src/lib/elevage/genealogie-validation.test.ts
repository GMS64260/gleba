import { describe, expect, it, vi } from "vitest"
import { verifierLienParenteSansCycle, type NoeudParents } from "./genealogie-validation"

const chargeur = (noeuds: NoeudParents[]) => vi.fn(async (ids: number[]) =>
  noeuds.filter((noeud) => ids.includes(noeud.id)),
)

describe("validation des liens de parenté", () => {
  it("refuse l'auto-parenté", async () => {
    expect(await verifierLienParenteSansCycle({
      animalId: 7,
      parentId: 7,
      chargerParents: chargeur([]),
    })).toBe(false)
  })

  it("refuse un descendant direct comme parent", async () => {
    expect(await verifierLienParenteSansCycle({
      animalId: 1,
      parentId: 2,
      chargerParents: chargeur([{ id: 2, mereId: 1, pereId: null }]),
    })).toBe(false)
  })

  it("refuse un descendant indirect sans limite arbitraire de génération", async () => {
    expect(await verifierLienParenteSansCycle({
      animalId: 1,
      parentId: 5,
      chargerParents: chargeur([
        { id: 5, mereId: 4, pereId: null },
        { id: 4, mereId: 3, pereId: null },
        { id: 3, mereId: 2, pereId: null },
        { id: 2, mereId: 1, pereId: null },
      ]),
    })).toBe(false)
  })

  it("accepte un ascendant partagé et termine sur une ancienne boucle étrangère", async () => {
    const chargerParents = chargeur([
      { id: 8, mereId: 4, pereId: 5 },
      { id: 4, mereId: 3, pereId: null },
      { id: 5, mereId: 3, pereId: null },
      { id: 3, mereId: 4, pereId: null },
    ])

    expect(await verifierLienParenteSansCycle({
      animalId: 1,
      parentId: 8,
      chargerParents,
    })).toBe(true)
    expect(chargerParents.mock.calls.length).toBeLessThan(6)
  })
})
