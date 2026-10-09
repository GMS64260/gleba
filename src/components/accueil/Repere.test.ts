import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { Repere } from "./Repere"

describe("Repere", () => {
  it("affiche la valeur en chiffres tabulaires, l'unité secondaire, le détail et l'alerte", () => {
    const html = renderToStaticMarkup(
      createElement(Repere, { libelle: "Trésorerie", valeur: "24 297", unite: "€", detail: "marge 73 %", alerte: "2 créances" }),
    )
    expect(html).toContain("Trésorerie")
    expect(html).toContain("tabular-nums")
    expect(html).toContain("24 297")
    expect(html).toContain("€")
    expect(html).toContain("marge 73 %")
    expect(html).toContain("2 créances")
    expect(html).toContain("text-argile")
  })

  it("a un état vide obligatoire quand il n'y a pas de donnée", () => {
    const html = renderToStaticMarkup(createElement(Repere, { libelle: "Récoltes 2026", valeur: null, unite: "kg" }))
    expect(html).toContain("data-vide")
    expect(html).toContain("Pas encore de donnée")
    expect(html).not.toContain("tabular-nums")
    const zero = renderToStaticMarkup(createElement(Repere, { libelle: "Tâches", valeur: 0 }))
    expect(zero).not.toContain("data-vide")
  })

  it("devient un lien quand il a une adresse", () => {
    const html = renderToStaticMarkup(createElement(Repere, { libelle: "Cultures", valeur: 29, href: "/maraichage" }))
    expect(html).toContain('href="/maraichage"')
  })
})
