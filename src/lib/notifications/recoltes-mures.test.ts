import { describe, expect, it } from "vitest"
import {
  DUREE_CULTURE_FALLBACK_JOURS,
  FENETRE_RECOLTE_MURE_AVANCE_JOURS,
  calculerRecoltesMures,
} from "./detect"
import type { CultureRecolteInput } from "./detect"

// Référence fixe : jeudi 13 août 2026 (même convention que detect.test.ts).
const REFERENCE = new Date(2026, 7, 13)

/** Culture semée `joursRestants` jours avant sa maturité (durée par défaut). */
function culture(
  overrides: Partial<CultureRecolteInput> & { dateSemis?: Date | null } = {}
): CultureRecolteInput {
  return {
    id: 1,
    dateSemis: new Date(2026, 7, 13 - 60), // mûre aujourd'hui avec durée 60 j
    datePlantation: null,
    recolteFaite: false,
    dureeCultureJours: 60,
    especeNom: "Carotte",
    plancheNom: "P3",
    ...overrides,
  }
}

/** Date de semis telle que maturité = REFERENCE + joursRestants (durée `duree`). */
function semisPourMaturite(joursRestants: number, duree: number): Date {
  return new Date(2026, 7, 13 - duree + joursRestants)
}

describe("calculerRecoltesMures", () => {
  it("détecte une culture mûre aujourd'hui (semis + durée = aujourd'hui)", () => {
    const mures = calculerRecoltesMures([culture()], REFERENCE)
    expect(mures).toHaveLength(1)
    expect(mures[0]).toMatchObject({
      cultureId: 1,
      especeNom: "Carotte",
      plancheNom: "P3",
      joursRestants: 0,
      dureeJours: 60,
      dateMaturite: "2026-08-13",
    })
  })

  it("prévient à J-3 avant la maturité (fenêtre de déclenchement)", () => {
    const mures = calculerRecoltesMures(
      [culture({ dateSemis: semisPourMaturite(3, 60) })],
      REFERENCE
    )
    expect(mures).toHaveLength(1)
    expect(mures[0].joursRestants).toBe(3)
    expect(mures[0].dateMaturite).toBe("2026-08-16")
  })

  it("n'alerte pas au-delà de la fenêtre (J-4)", () => {
    const mures = calculerRecoltesMures(
      [culture({ dateSemis: semisPourMaturite(4, 60) })],
      REFERENCE
    )
    expect(mures).toHaveLength(0)
  })

  it("exclut les cultures déjà récoltées", () => {
    const mures = calculerRecoltesMures(
      [culture({ recolteFaite: true }), culture({ id: 2, dateSemis: semisPourMaturite(1, 60) })],
      REFERENCE
    )
    expect(mures).toHaveLength(1)
    expect(mures[0].cultureId).toBe(2)
  })

  it("utilise la durée par défaut (90 j) quand l'ITP ne la donne pas", () => {
    const mures = calculerRecoltesMures(
      [culture({ dureeCultureJours: null, dateSemis: semisPourMaturite(0, 90) })],
      REFERENCE
    )
    expect(mures).toHaveLength(1)
    expect(mures[0].dureeJours).toBe(DUREE_CULTURE_FALLBACK_JOURS)
    expect(mures[0].joursRestants).toBe(0)
  })

  it("privilégie la date de plantation quand elle existe", () => {
    // Plantation il y a 60 j (mûre aujourd'hui) mais semis il y a 90 j :
    // c'est la plantation qui doit piloter la maturité.
    const mures = calculerRecoltesMures(
      [
        culture({
          dateSemis: semisPourMaturite(30, 60),
          datePlantation: semisPourMaturite(0, 60),
        }),
      ],
      REFERENCE
    )
    expect(mures).toHaveLength(1)
    expect(mures[0].joursRestants).toBe(0)
  })

  it("tolère un léger dépassement (mûre depuis 1 j) mais pas un oubli de 5 j", () => {
    const recente = calculerRecoltesMures(
      [culture({ dateSemis: semisPourMaturite(-1, 60) })],
      REFERENCE
    )
    expect(recente).toHaveLength(1)
    expect(recente[0].joursRestants).toBe(-1)

    const oubliee = calculerRecoltesMures(
      [culture({ dateSemis: semisPourMaturite(-5, 60) })],
      REFERENCE
    )
    expect(oubliee).toHaveLength(0)
  })

  it("ignore les cultures sans date de semis ni de plantation", () => {
    const mures = calculerRecoltesMures([culture({ dateSemis: null, datePlantation: null })], REFERENCE)
    expect(mures).toHaveLength(0)
  })

  it("trie les récoltes des plus imminentes aux moins imminentes", () => {
    const mures = calculerRecoltesMures(
      [
        culture({ id: 3, dateSemis: semisPourMaturite(2, 60) }),
        culture({ id: 1, dateSemis: semisPourMaturite(0, 60) }),
        culture({ id: 2, dateSemis: semisPourMaturite(3, 60) }),
      ],
      REFERENCE
    )
    expect(mures.map((m) => m.cultureId)).toEqual([1, 3, 2])
  })

  it("respecte une fenêtre personnalisée (résumé quotidien : jour J, sans avance)", () => {
    // Maturité demain : exclue du résumé du jour (avance 0)…
    const demain = calculerRecoltesMures(
      [culture({ dateSemis: semisPourMaturite(1, 60) })],
      REFERENCE,
      { avanceJours: 0, depassementJours: 3 }
    )
    expect(demain).toHaveLength(0)

    // …mais mûre depuis 2 j : rappelée (dépassement borné à 3 j).
    const depuis2j = calculerRecoltesMures(
      [culture({ dateSemis: semisPourMaturite(-2, 60) })],
      REFERENCE,
      { avanceJours: 0, depassementJours: 3 }
    )
    expect(depuis2j).toHaveLength(1)
    expect(depuis2j[0].joursRestants).toBe(-2)
  })

  it("expose une fenêtre de déclenchement par défaut de 3 jours", () => {
    expect(FENETRE_RECOLTE_MURE_AVANCE_JOURS).toBe(3)
  })

  it("ne détecte rien sans aucune culture", () => {
    expect(calculerRecoltesMures([], REFERENCE)).toHaveLength(0)
  })
})
