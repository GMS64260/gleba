import { describe, expect, it } from "vitest"
import { alerteUrgenteEmail, resumeQuotidienEmail } from "./templates"
import type { DestinataireNotification, ResumeQuotidien } from "./types"

const user: DestinataireNotification = { id: "user-1", email: "test@example.com", name: "Alex" }

const resume: ResumeQuotidien = {
  date: "2026-08-10",
  taches: [],
  alertesMeteo: [],
  stocksBas: [
    {
      type: "variete",
      stockId: 1,
      nom: "Tomate <ancienne>",
      unite: "g",
      quantite: 40,
      seuilMin: 100,
      ratio: 0.4,
      key: "stock-bas:variete:1:100:graines",
    },
  ],
}

describe("template irrigation rappel", () => {
  it("utilise un objet et un accent ambre, et renvoie vers un écran qui existe", () => {
    const email = alerteUrgenteEmail(user, {
      type: "irrigation-rappel",
      titre: "Tomate — planche S4",
      message: "L'irrigation prévue le 12/08/2026 n'a pas été marquée comme faite.",
      key: "irrigation-rappel:42:2026-08-13",
    })

    expect(email.subject).toBe("[Gleba] Irrigation à faire : Tomate — planche S4")
    expect(email.html).toContain("Irrigation à faire")
    expect(email.html).toContain("linear-gradient(135deg,#b45309,#f59e0b)")
    // `/calendrier` n'a jamais existé : le lien tombait en 404.
    expect(email.html).toContain('href="https://gleba.fr/taches"')
    expect(email.html).toContain("Voir mes tâches →")
    expect(email.html).not.toContain('href="https://gleba.fr/calendrier"')
  })
})

describe("templates stocks bas", () => {
  it("affiche la liste et le lien de réapprovisionnement dans le résumé", () => {
    const email = resumeQuotidienEmail(user, resume)

    expect(email.html).toContain("Stocks bas")
    expect(email.html).toContain("Tomate &lt;ancienne&gt;")
    expect(email.html).toContain("Voir les stocks et réapprovisionner")
    expect(email.html).toContain("/comptabilite/stocks")
  })

  it("rend une alerte urgente dédiée pour un stock critique", () => {
    const email = alerteUrgenteEmail(user, {
      type: "stock-bas",
      titre: "stock critique : Foin",
      message: "Foin : 0 kg (seuil 10 kg, 0%). Réapprovisionnement recommandé.",
      key: "stock-bas:aliment:2:10",
    })

    expect(email.subject).toContain("Stock critique")
    expect(email.html).toContain("Stock critique")
    expect(email.html).toContain("Gérer les stocks")
    expect(email.html).toContain("/comptabilite/stocks")
  })
})
