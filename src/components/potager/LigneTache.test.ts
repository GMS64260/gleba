import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { LigneArrosage, LigneTache } from "./LigneTache"

describe("LigneTache", () => {
  it("rend une récolte en retard : liseré critique, verbe en pastille, retard en métadonnée, action Noter et report", () => {
    const html = renderToStaticMarkup(
      createElement(LigneTache, {
        type: "recolte",
        especeNom: "Radis",
        varieteNom: "Rond écarlate",
        plancheNom: "B1",
        couleur: "#aa3355",
        date: "2026-09-11T00:00:00.000Z",
        fait: false,
        retardJours: 28,
        onAction: () => {},
        onReporter: () => {},
      }),
    )
    expect(html).toContain('data-etat="critique"')
    expect(html).toContain("En retard")
    expect(html).toContain("4 sem. de retard")
    expect(html).toContain("Rond écarlate")
    expect(html).toContain("B1")
    expect(html).toContain("Prévu le 11/09")
    expect(html).toContain(">Noter<")
    expect(html).toContain('aria-label="Reporter cette échéance"')
    expect(html).not.toContain("bg-red")
  })

  it("rend un semis fait : état ok, nom barré, Annuler, sans report", () => {
    const html = renderToStaticMarkup(
      createElement(LigneTache, { type: "semis", especeNom: "Carotte", fait: true, retardJours: 3, onAction: () => {}, onReporter: () => {} }),
    )
    expect(html).toContain('data-etat="ok"')
    expect(html).toContain("Semé")
    expect(html).toContain("line-through")
    expect(html).toContain(">Annuler<")
    expect(html).not.toContain("de retard")
    expect(html).not.toContain("Reporter")
  })
})

describe("LigneArrosage", () => {
  it("rend un arrosage probablement inutile avec sa raison météo, en info, sans retard", () => {
    const demain = new Date(Date.now() + 86_400_000).toISOString()
    const html = renderToStaticMarkup(
      createElement(LigneArrosage, {
        titre: "A3",
        details: ["Tomate", "3 cultures"],
        datePrevue: demain,
        probablementInutile: true,
        noteMeteo: "8mm de pluie prévue — irrigation probablement inutile",
        onAction: () => {},
      }),
    )
    expect(html).toContain('data-etat="info"')
    expect(html).toContain("Pluie prévue")
    expect(html).toContain("Tomate")
    expect(html).toContain("3 cultures")
    expect(html).toContain("8mm de pluie prévue")
    expect(html).toContain(">Fait<")
  })

  it("rend un arrosage du jour en attention, « À arroser »", () => {
    const html = renderToStaticMarkup(
      createElement(LigneArrosage, { titre: "Sans planche", datePrevue: new Date().toISOString(), onAction: () => {} }),
    )
    expect(html).toContain('data-etat="attention"')
    expect(html).toContain("À arroser")
    expect(html).toContain("Aujourd&#x27;hui")
  })
})
