import { describe, expect, it } from "vitest"

import {
  grouperIrrigationsPlanifieesParPlancheEtJour,
  grouperRecommandationsParPlanche,
  irrigationEstDue,
} from "@/lib/irrigation-planche"

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

  it("regroupe les tâches du même jour mais garde deux passages de dates différentes", () => {
    const irrigations = grouperIrrigationsPlanifieesParPlancheEtJour([
      {
        id: 1,
        cultureId: 10,
        plancheId: "Serre A",
        datePrevue: "2026-07-30T00:00:00.000Z",
        especeNom: "Poivron",
        fait: false,
        retardJours: 0,
        pluiePrevue: 2,
        probablementInutile: false,
      },
      {
        id: 2,
        cultureId: 11,
        plancheId: "Serre A",
        datePrevue: "2026-07-30T00:00:00.000Z",
        especeNom: "Melon",
        fait: false,
        retardJours: 0,
        pluiePrevue: 3,
        probablementInutile: false,
      },
      {
        id: 3,
        cultureId: 10,
        plancheId: "Serre A",
        datePrevue: "2026-08-01T00:00:00.000Z",
        especeNom: "Poivron",
        fait: false,
        retardJours: 0,
        pluiePrevue: null,
        probablementInutile: false,
      },
    ])

    expect(irrigations).toHaveLength(2)
    expect(irrigations[0]).toMatchObject({
      irrigationIds: [1, 2],
      cultureIds: [10, 11],
      cultureCount: 2,
      especeNom: "Poivron + Melon",
      pluiePrevue: 3,
    })
  })

  it("n'auto-valide pas demain simplement parce que l'échéance est à moins de 24 h", () => {
    const maintenant = new Date("2026-07-29T20:00:00.000Z")

    expect(irrigationEstDue(
      new Date("2026-07-30T00:00:00.000Z"),
      maintenant
    )).toBe(false)
    expect(irrigationEstDue(
      new Date("2026-07-29T00:00:00.000Z"),
      maintenant
    )).toBe(true)
  })
})
