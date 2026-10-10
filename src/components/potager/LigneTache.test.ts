import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { LigneArrosage, LigneTache, varieteAffichable } from "./LigneTache"

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

describe("varieteAffichable", () => {
  it("tait une variété « Non spécifiée », garde les autres", () => {
    expect(varieteAffichable("Non spécifiée")).toBe("")
    expect(varieteAffichable("non specifiee")).toBe("")
    expect(varieteAffichable(null)).toBe("")
    expect(varieteAffichable("Coco de Prague")).toBe("Coco de Prague")
    const html = renderToStaticMarkup(
      createElement(LigneTache, { type: "recolte", especeNom: "Radis", varieteNom: "Non spécifiée", fait: false, onAction: () => {} }),
    )
    expect(html).not.toContain("Non spécifiée")
  })
})

describe("LigneArrosage", () => {
  it("rend une planche à arroser en critique, avec espèces, cultures et raison du bilan hydrique", () => {
    const html = renderToStaticMarkup(
      createElement(LigneArrosage, {
        titre: "A3",
        urgence: "critique",
        details: ["Tomate + Basilic", "3 cultures", "Déficit de 18mm. 5j sans eau. Pas de pluie prévue."],
        onAction: () => {},
      }),
    )
    expect(html).toContain('data-etat="critique"')
    expect(html).toContain("À arroser")
    expect(html).toContain("Tomate + Basilic")
    expect(html).toContain("3 cultures")
    expect(html).toContain("Déficit de 18mm")
    expect(html).toContain(">Noter<")
    // Plus de retard ni de date prévue : le besoin se recalcule chaque jour.
    expect(html).not.toContain("retard")
  })

  it("rend une urgence haute en attention", () => {
    const html = renderToStaticMarkup(createElement(LigneArrosage, { titre: "B1", urgence: "haute", onAction: () => {} }))
    expect(html).toContain('data-etat="attention"')
    expect(html).toContain("À arroser")
  })
})
