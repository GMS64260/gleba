import { describe, expect, it } from "vitest"

import { construireCsv } from "./export-csv"

describe("export CSV des écrans de planification", () => {
  it("garde les colonnes quand un nom contient « ; », des guillemets ou un saut de ligne", () => {
    const csv = construireCsv([
      ["Espèce", "Planche"],
      ['Tomate "Cœur"', "Serre; nord\nbis"],
    ])
    expect(csv).toBe('﻿"Espèce";"Planche"\r\n"Tomate ""Cœur""";"Serre; nord\nbis"\r\n')
  })

  it("neutralise une cellule qu’un tableur exécuterait comme une formule", () => {
    const csv = construireCsv([["=HYPERLINK(\"http://exemple.test\")", "@planche", "+1"]])
    expect(csv).toContain(`"'=HYPERLINK(""http://exemple.test"")"`)
    expect(csv).toContain(`"'@planche"`)
    expect(csv).toContain(`"'+1"`)
  })

  it("écrit un nombre tel quel et une valeur absente en cellule vide", () => {
    expect(construireCsv([[12.5, null, undefined, -3]])).toBe('﻿12.5;"";"";-3\r\n')
  })

  it("commence par le BOM UTF-8, pour les accents sous Excel", () => {
    expect(construireCsv([["Îlot"]]).charCodeAt(0)).toBe(0xfeff)
  })
})
