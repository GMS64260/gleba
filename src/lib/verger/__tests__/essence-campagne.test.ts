import { describe, it, expect } from "vitest"
import { nomEssenceCampagne } from "../essence-campagne"

describe("nomEssenceCampagne (ticket cmv2908du)", () => {
  it("préfère le nom de l'espèce liée à un cuid recopié en texte libre", () => {
    expect(
      nomEssenceCampagne({
        essenceLibre: "cmuu5t8mx005gk6bhtdop6pt9",
        espece: { nom: "Pamplemoussier", nomLatin: "Citrus paradisi" },
      }),
    ).toBe("Pamplemoussier")
  })

  it("garde le texte libre sans espèce liée", () => {
    expect(nomEssenceCampagne({ essenceLibre: "Chêne sessile", espece: null })).toBe("Chêne sessile")
  })

  it("catalogue historique sans nom : texte libre, puis nom latin", () => {
    expect(nomEssenceCampagne({ essenceLibre: "Pommier", espece: { nom: null, nomLatin: "Malus domestica" } })).toBe("Pommier")
    expect(nomEssenceCampagne({ essenceLibre: null, espece: { nom: null, nomLatin: "Malus domestica" } })).toBe("Malus domestica")
    expect(nomEssenceCampagne({ essenceLibre: null, espece: null })).toBeNull()
  })
})
