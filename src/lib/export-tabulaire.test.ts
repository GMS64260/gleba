import { describe, expect, it } from "vitest"
import { strFromU8, unzipSync } from "fflate"
import { construireArchiveTabulaire, nomFichierTable, tableEnCsv } from "./export-tabulaire"

describe("export tabulaire", () => {
  it("produit une vraie archive ZIP, un CSV par table non vide, avec des noms ASCII", () => {
    const { archive, fichiers } = construireArchiveTabulaire({
      dateExport: new Date("2026-09-25T10:00:00Z"),
      tables: [
        { modele: "Animal", nomTable: "animaux", rows: [{ id: 1, userId: "u1", nom: "Truffe", statut: "actif" }] },
        { modele: "SoinAnimal", nomTable: "soins_animaux", rows: [{ id: 3, userId: "u1", produit: "Valbazen", date: new Date("2025-04-12T00:00:00Z") }] },
        { modele: "Recolte", nomTable: "récoltes", rows: [{ id: 9, quantite: 2.5 }] },
        { modele: "Planche", nomTable: "planches", rows: [] },
      ],
    })

    // Signature ZIP « PK\x03\x04 » : le fichier s'ouvre dans n'importe quel utilitaire.
    expect([...archive.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04])
    const contenu = unzipSync(archive)
    expect(Object.keys(contenu).sort()).toEqual(["LISEZMOI.txt", "animaux.csv", "recoltes.csv", "soins_animaux.csv"])
    expect(fichiers.map((f) => f.fichier)).toEqual(["animaux.csv", "recoltes.csv", "soins_animaux.csv"])

    // BOM UTF-8 en tête (Excel lit alors les accents correctement).
    expect([...contenu["soins_animaux.csv"].slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const soins = strFromU8(contenu["soins_animaux.csv"])
    expect(soins).toContain('"id";"produit";"date"')
    expect(soins).toContain('"3";"Valbazen";"2025-04-12T00:00:00.000Z"')
    expect(soins).not.toContain("userId")
    expect(strFromU8(contenu["LISEZMOI.txt"])).toContain("animaux.csv : 1 ligne")
  })

  it("n'écrit jamais de jeton ni de secret et neutralise les formules de tableur", () => {
    const csv = tableEnCsv([
      { id: 1, emailVerifyToken: "abc", apiKey: "k", note: "=HYPERLINK(\"x\")", details: { a: 1 } },
    ])
    expect(csv).not.toContain("abc")
    expect(csv).not.toContain("apiKey")
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`)
    expect(csv).toContain('"{""a"":1}"')
  })

  it("dérive un nom de fichier du modèle quand la table n'a pas de nom SQL", () => {
    expect(nomFichierTable("HistoriqueLotAnimal")).toBe("historique_lot_animal.csv")
    expect(nomFichierTable("Recolte", "récoltes")).toBe("recoltes.csv")
  })
})
