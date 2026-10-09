import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { Tuile } from "./Tuile"
import { RepereRangee, TuileGrille } from "./TuileGrille"

describe("Tuile", () => {
  it("rend l'en-tête, le corps, la largeur et la hauteur en colonnes", () => {
    const html = renderToStaticMarkup(
      createElement(Tuile, { titre: "Aujourd'hui", sousTitre: "6 choses", largeur: 7, hauteur: 2, idTuile: "aujourdhui" }, "corps"),
    )
    expect(html).toContain("Aujourd&#x27;hui")
    expect(html).toContain("6 choses")
    expect(html).toContain("corps")
    expect(html).toContain("lg:col-span-7")
    expect(html).toContain("lg:row-span-2")
    expect(html).toContain('data-tuile="aujourdhui"')
  })

  it("remplace le corps par l'état vide quand il n'y a rien à montrer", () => {
    const html = renderToStaticMarkup(
      createElement(Tuile, { titre: "Élevage", vide: true, messageVide: "Aucun soin prévu aujourd'hui" }, "corps"),
    )
    expect(html).toContain("data-vide")
    expect(html).toContain("Aucun soin prévu aujourd&#x27;hui")
    expect(html).not.toContain("corps")
  })

  it("pose le rang d'entrée pour le mouvement, sans classe d'animation sinon", () => {
    const avec = renderToStaticMarkup(createElement(Tuile, { titre: "Semaine", rang: 3 }))
    expect(avec).toContain("accueil-entree")
    expect(avec).toContain("--rang:3")
    const sans = renderToStaticMarkup(createElement(Tuile, { titre: "Semaine" }))
    expect(sans).not.toContain("accueil-entree")
  })
})

describe("TuileGrille", () => {
  it("empile sur mobile et passe à douze colonnes sur grand écran", () => {
    const html = renderToStaticMarkup(createElement(TuileGrille, null, createElement(Tuile, { titre: "A" })))
    expect(html).toContain("grid-cols-1")
    expect(html).toContain("lg:grid-cols-12")
  })

  it("range les repères par deux sur mobile et par cinq sur grand écran", () => {
    const html = renderToStaticMarkup(createElement(RepereRangee, null))
    expect(html).toContain("grid-cols-2")
    expect(html).toContain("lg:grid-cols-5")
  })
})
