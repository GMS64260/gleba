import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { LigneRegistre } from "./LigneRegistre"

describe("LigneRegistre", () => {
  it("affiche le liseré de l'état, le titre et les métadonnées séparées par un point médian", () => {
    const html = renderToStaticMarkup(
      createElement(LigneRegistre, {
        etat: "attention",
        titre: "Récolter radis B1",
        meta: ["Prêt depuis 3 semaines", "", "4 kg attendus"],
      }),
    )
    expect(html).toContain('data-etat="attention"')
    expect(html).toContain("bg-paille")
    expect(html).toContain("Récolter radis B1")
    expect(html).toContain("Prêt depuis 3 semaines")
    expect(html).toContain("4 kg attendus")
    expect(html.match(/·/g)?.length).toBe(1)
  })

  it("rend l'action en lien quand elle a une adresse, en bouton sinon, avec une cible de 44 px", () => {
    const lien = renderToStaticMarkup(
      createElement(LigneRegistre, { etat: "ok", titre: "Facture AMAP", action: { libelle: "Envoyer", href: "/comptabilite" } }),
    )
    expect(lien).toContain('href="/comptabilite"')
    expect(lien).toContain("min-h-11")
    const bouton = renderToStaticMarkup(
      createElement(LigneRegistre, { etat: "ok", titre: "Facture AMAP", action: { libelle: "Fait" } }),
    )
    expect(bouton).toContain('<button type="button"')
    expect(bouton).toContain("Fait")
  })

  it("n'ouvre pas de zone d'action sans pastille ni action", () => {
    const html = renderToStaticMarkup(createElement(LigneRegistre, { etat: "neutre", titre: "Rien" }))
    expect(html).not.toContain("<button")
    expect(html).not.toContain("<a ")
  })
})
