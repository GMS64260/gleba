import { describe, expect, it } from "vitest"

import { construireCsv } from "@/app/maraichage/planification/export-csv"
import { lignesCsvAssociations, texteDescription, texteDetails } from "./texte-association"

const brocoli = {
  nom: "Chou brocoli +",
  type: "favorable",
  description: null,
  details: [
    { especeId: "Chou brocoli", familleId: "Brassicaceae", groupe: null, requise: true },
    { especeId: "Concombre", familleId: "Cucurbitaceae", groupe: null, requise: false },
    { especeId: null, familleId: "Fabaceae", groupe: null, requise: false },
  ],
}

describe("textes de l'écran des associations", () => {
  it("rend toujours une chaîne, pour que la recherche globale lise la colonne", () => {
    expect(texteDetails(brocoli)).toBe("Chou brocoli, Concombre, Fabaceae")
    expect(texteDetails({ details: [] })).toBe("")
    expect(texteDescription(brocoli)).toBe("")
  })

  it("exporte le type et ne décale pas les colonnes sur un point-virgule", () => {
    const lignes = lignesCsvAssociations([
      {
        nom: "Ail Carotte",
        type: "incompatible",
        description: "L'ail repousse la mouche de la carotte ; effet réciproque modeste.",
        details: [],
      },
      brocoli,
    ])
    expect(lignes[0]).toContain("Type")
    expect(lignes[1][1]).toBe("Incompatible")
    // Famille d'annotation d'une espèce : pas dans la colonne Familles.
    expect(lignes[2][4]).toBe("Fabaceae")
    expect(lignes[2][6]).toBe("Chou brocoli")

    const csv = construireCsv(lignes)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    const [entete, premiere] = csv.slice(1).split("\r\n")
    const colonnes = (ligne: string) => ligne.match(/("(?:[^"]|"")*"|[^;]+)(?=;|$)/g)?.length
    expect(colonnes(premiere)).toBe(colonnes(entete))
  })
})
