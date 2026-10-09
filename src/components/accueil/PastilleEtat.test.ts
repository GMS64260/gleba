import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { ETATS_REGISTRE, PastilleEtat } from "./PastilleEtat"

describe("PastilleEtat", () => {
  it("porte le libellé, l'état en attribut et une icône (jamais la couleur seule)", () => {
    const html = renderToStaticMarkup(createElement(PastilleEtat, { etat: "critique", libelle: "À arroser" }))
    expect(html).toContain("À arroser")
    expect(html).toContain('data-etat="critique"')
    expect(html).toContain("<svg")
    expect(html).toContain("text-argile")
  })

  it("rend chaque état avec une couleur de la charte distincte", () => {
    const classes = ETATS_REGISTRE.map((etat) =>
      renderToStaticMarkup(createElement(PastilleEtat, { etat, libelle: etat })),
    )
    expect(new Set(classes).size).toBe(ETATS_REGISTRE.length)
    for (const html of classes) expect(html).toMatch(/text-(argile|ocre|prairie|eau|ardoise)/)
  })
})
