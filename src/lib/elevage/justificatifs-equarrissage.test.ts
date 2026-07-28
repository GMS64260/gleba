import { describe, expect, it } from "vitest"
import { justificatifEquarrissageInputSchema } from "./justificatifs-equarrissage"

const base = {
  typeDocument: "BON_ENLEVEMENT",
  dateEnlevement: "2026-07-24",
  animalIds: [12],
  nombreAnimauxNonIdentifies: 0,
  typeAnimauxNonIdentifies: null,
  reference: "BE-2026-0042",
  prestataire: "Équarrissage régional",
  fichierUrl: null,
  nomFichier: null,
  notes: null,
}

describe("justificatifEquarrissageInputSchema", () => {
  it("accepte un bon papier rattaché à plusieurs mortalités", () => {
    const result = justificatifEquarrissageInputSchema.safeParse({
      ...base,
      animalIds: [12, 18],
    })
    expect(result.success).toBe(true)
  })

  it("accepte un enlèvement collectif non identifié avec son type", () => {
    const result = justificatifEquarrissageInputSchema.safeParse({
      ...base,
      animalIds: [],
      nombreAnimauxNonIdentifies: 15,
      typeAnimauxNonIdentifies: "Lot de volailles L-2026-03",
    })
    expect(result.success).toBe(true)
  })

  it("refuse un bon sans mortalité ni effectif", () => {
    const result = justificatifEquarrissageInputSchema.safeParse({
      ...base,
      animalIds: [],
    })
    expect(result.success).toBe(false)
  })

  it("refuse un effectif non identifié sans type ou lot", () => {
    const result = justificatifEquarrissageInputSchema.safeParse({
      ...base,
      animalIds: [],
      nombreAnimauxNonIdentifies: 3,
    })
    expect(result.success).toBe(false)
  })

  it("refuse les doublons d’animaux et les URL externes", () => {
    expect(justificatifEquarrissageInputSchema.safeParse({
      ...base,
      animalIds: [12, 12],
    }).success).toBe(false)
    expect(justificatifEquarrissageInputSchema.safeParse({
      ...base,
      fichierUrl: "https://example.test/bon.pdf",
      nomFichier: "bon.pdf",
    }).success).toBe(false)
  })
})
