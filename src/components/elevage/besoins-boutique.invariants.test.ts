import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ListeBesoins } from "./BesoinsBoutique"

const GRAINE = 0xb35011

describe(`affichage des besoins : invariants, graine ${GRAINE}`, () => {
  it("conserve les grandeurs et l’unité de chaque stock sur 320 réponses générées", () => {
    let etat = GRAINE
    const entier = (max: number) => { etat = (Math.imul(etat, 1664525) + 1013904223) >>> 0; return etat % max }
    for (let scenario = 0; scenario < 320; scenario++) {
      const unite = ["pièce", "kg", "g"][entier(3)]
      // Le manque est volontairement indépendant : la présentation n’est pas un calcul de stock.
      const besoin = { type: unite === "pièce" ? "oeufs" : "ruche", ref: "stock", nom: "Production fictive", unite, quantite: entier(9999) / 10, disponible: entier(9999) / 10, manque: entier(9999) / 10, commandes: entier(50) + 1, retraitLePlusProche: null }
      const texte = renderToStaticMarkup(createElement(ListeBesoins, { besoins: [besoin] }))
      const nombre = (v: number) => v.toLocaleString("fr-FR", { maximumFractionDigits: 3 })
      expect(texte, `scénario ${scenario}`).toContain(`${nombre(besoin.quantite)} ${unite} à fournir pour ${besoin.commandes} commande`)
      expect(texte).toContain(`Stock libre : ${nombre(besoin.disponible)} ${unite}`)
      if (besoin.manque > 0) expect(texte).toContain(`Reste à produire : ${nombre(besoin.manque)} ${unite}`)
      expect(texte).toContain("date de retrait non précisée")
      expect(texte).not.toContain(unite === "pièce" ? " kg" : " pièce")
    }
  })
})
