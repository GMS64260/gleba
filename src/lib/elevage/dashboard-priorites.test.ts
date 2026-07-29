import { describe, expect, it } from "vitest"
import {
  attentesSanitairesPrioritaires,
  soinsSanitairesPrioritaires,
} from "./dashboard-priorites"

describe("priorités sanitaires du dashboard", () => {
  it("remonte les trois soins les plus urgents par date planifiée", () => {
    const result = soinsSanitairesPrioritaires([
      { id: 4, date: "2026-07-29", datePrevue: "2026-08-05" },
      { id: 2, date: "2026-07-29", datePrevue: "2026-07-30" },
      { id: 1, date: "2026-07-29", datePrevue: "2026-07-28" },
      { id: 3, date: "2026-07-29", datePrevue: "2026-07-31" },
    ])

    expect(result.map((item) => item.id)).toEqual([1, 2, 3])
  })

  it("trie les délais selon la première remise en vente lait ou viande", () => {
    const result = attentesSanitairesPrioritaires([
      {
        id: "a",
        lait: { remiseVente: "2026-08-04" },
        viande: { remiseVente: "2026-08-01" },
      },
      {
        id: "b",
        lait: { remiseVente: "2026-07-31" },
        viande: null,
      },
      {
        id: "c",
        lait: null,
        viande: { remiseVente: "2026-08-02" },
      },
    ])

    expect(result.map((item) => item.id)).toEqual(["b", "a", "c"])
  })
})
