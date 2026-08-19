import { describe, expect, it } from "vitest"

import { calculateRotationAdvice } from "./index"

// QA cmsw8pzzw (2026-08-16) — une culture d'année future (plan de rotation
// matérialisé en lignes `cultures`) était traitée comme un précédent cultural :
// « Fabaceae planté en 2027, attendre 2030 » bloquait la famille dès août 2026
// et « 2027 - Haricot sec » figurait dans les cultures récentes.

const FAMILLES = [
  { id: "Fabaceae", intervalle: 3, couleur: "#22c55e" },
  { id: "Brassicaceae", intervalle: 4, couleur: "#3b82f6" },
]

function culture(annee: number, especeId: string, familleId: string, intervalle: number) {
  return {
    annee,
    especeId,
    espece: {
      id: especeId,
      familleId,
      famille: { id: familleId, intervalle, couleur: null },
      besoinN: 2,
      besoinP: 2,
      besoinK: 2,
    },
  }
}

describe("calculateRotationAdvice — cultures d'années futures", () => {
  it("ignore une culture projetée en année future dans les familles bloquées et les cultures récentes", () => {
    const advice = calculateRotationAdvice({
      plancheId: "p1",
      targetYear: 2026,
      cultures: [culture(2027, "haricot-sec", "Fabaceae", 3)],
      allFamilies: FAMILLES,
    })

    expect(advice.blockedFamilies).toHaveLength(0)
    expect(advice.recentCultures).toHaveLength(0)
  })

  it("continue de bloquer une famille cultivée l'année visée (comportement Bug #4 conservé)", () => {
    const advice = calculateRotationAdvice({
      plancheId: "p1",
      targetYear: 2026,
      cultures: [culture(2026, "haricot-sec", "Fabaceae", 3)],
      allFamilies: FAMILLES,
    })

    const fabaceae = advice.blockedFamilies.find((b) => b.familleId === "Fabaceae")
    expect(fabaceae).toBeDefined()
    expect(fabaceae?.lastYear).toBe(2026)
    expect(advice.recentCultures).toHaveLength(1)
  })

  it("continue de bloquer une famille selon un précédent réellement acquis", () => {
    const advice = calculateRotationAdvice({
      plancheId: "p1",
      targetYear: 2026,
      cultures: [
        culture(2025, "chou", "Brassicaceae", 4),
        culture(2027, "haricot-sec", "Fabaceae", 3),
      ],
      allFamilies: FAMILLES,
    })

    expect(advice.blockedFamilies.map((b) => b.familleId)).toEqual(["Brassicaceae"])
    expect(advice.recentCultures.map((c) => c.annee)).toEqual([2025])
  })
})
