import { describe, expect, it } from "vitest"

import { grouperRecommandationsParPlanche } from "@/lib/irrigation-planche"

describe("irrigation d'une planche multiculture", () => {
  it("ne produit qu'une alerte par planche et conserve le besoin le plus exigeant", () => {
    const recommandations = grouperRecommandationsParPlanche([
      {
        cultureId: 10,
        cultureName: "Poivron",
        plancheId: "planche-a",
        plancheName: "Serre A",
        urgence: "haute" as const,
        conseilQuantite: 12,
        conseilMessage: "Arroser bientôt.",
        joursDepuisIrrigation: null,
        varietyName: "Doux",
        etatCulture: "Plantée",
        derniereIrrigation: null,
      },
      {
        cultureId: 11,
        cultureName: "Melon",
        plancheId: "planche-a",
        plancheName: "Serre A",
        urgence: "critique" as const,
        conseilQuantite: 18,
        conseilMessage: "Arroser maintenant.",
        joursDepuisIrrigation: 5,
        varietyName: null,
        etatCulture: "Plantée",
        derniereIrrigation: "2026-07-24T08:00:00.000Z",
      },
    ])

    expect(recommandations).toHaveLength(1)
    expect(recommandations[0]).toMatchObject({
      plancheId: "planche-a",
      urgence: "critique",
      conseilQuantite: 18,
      cultureIds: [10, 11],
      cultureCount: 2,
      cultureName: "Poivron · Doux + Melon",
      etatCulture: "2 cultures actives",
    })
    expect(recommandations[0].conseilMessage).toContain("besoin le plus exigeant (Melon)")
  })
})

describe("libellé de culture d'un conseil d'irrigation", () => {
  const reco = (cultureId: number, cultureName: string, varietyName: string | null) => ({
    cultureId,
    cultureName,
    plancheId: `planche-${cultureId}`,
    plancheName: "B5",
    urgence: "moyenne" as const,
    conseilQuantite: 5,
    conseilMessage: "Surveiller.",
    joursDepuisIrrigation: 2,
    varietyName,
    etatCulture: "Semée",
    derniereIrrigation: null,
  })

  it("dit chaque nom une seule fois", () => {
    const [radis, courge, aubergine] = grouperRecommandationsParPlanche([
      reco(1, "Radis", "Radis — Non spécifiée"),
      reco(2, "Courge butternut", "Courge butternut-Waltham"),
      reco(3, "Aubergine", "Violette longue"),
    ])
    expect(radis.cultureName).toBe("Radis")
    expect(radis.varietyName).toBeNull()
    expect(courge.cultureName).toBe("Courge butternut-Waltham")
    expect(aubergine.cultureName).toBe("Aubergine · Violette longue")
  })
})
