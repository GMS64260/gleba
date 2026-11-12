import { describe, expect, it } from "vitest"

import { construireCsv } from "@/app/maraichage/planification/export-csv"
import { libelleBilan, lignesCsvVoisinage, texteCulturesVoisines } from "./texte-voisinage"

const ligne = {
  plancheId: "B1 ; nord",
  ilot: null,
  cultureEspeceId: "Ail",
  cultureSemaine: 42,
  planchesVoisines: ["B2"],
  culturesVoisines: [
    { plancheId: "B2", especeId: "Haricot", eval: "defavorable" as const },
    { plancheId: "B2", especeId: null, eval: "neutre" as const },
  ],
  scoreAssociation: "defavorable" as const,
}

describe("textes de l'écran des associations de la planification", () => {
  it("donne au bilan et aux cultures voisines une valeur cherchable", () => {
    expect(libelleBilan("defavorable")).toBe("Défavorable")
    expect(texteCulturesVoisines(ligne)).toBe("B2 : Haricot (défavorable), B2 : ? (neutre)")
    expect(texteCulturesVoisines({ culturesVoisines: [] })).toBe("")
  })

  it("exporte sans décaler les colonnes ni lancer de formule", () => {
    const lignes = lignesCsvVoisinage([ligne])
    expect(lignes[1][6]).toBe("Défavorable")
    const csv = construireCsv(lignes)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('"B1 ; nord";"";"Ail";42;"B2"')
    // L'ancien export préfixait « - » ou « = » : lu comme une formule par un tableur.
    expect(csv).not.toMatch(/;"?[=+\-@]/)
  })
})
