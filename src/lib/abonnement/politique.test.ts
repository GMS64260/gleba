import { describe, expect, it } from "vitest"
import { calculerAcces, finEssai, aCapacite, type EtatAbonnement } from "./politique"
import { GRATUITE_EXISTANTS_JUSQUAU } from "./catalogue"
import { operationPermise } from "./requetes"
const maintenant = new Date("2027-03-01T12:00:00Z")
const nouveau = new Date("2026-11-09T00:00:00Z")
const etat = (overrides: Partial<EtatAbonnement> = {}): EtatAbonnement => ({ gratuitAVie: false, essaiDebut: new Date("2026-11-09"), essaiFin: new Date("2027-02-09"), formule: null, atelier: null, statut: null, payeJusquau: null, graceJusquau: null, ...overrides })
describe("droits du service hébergé", () => {
  it("conserve la gratuité complète à vie à la borne exacte, même après annulation ou fin d’essai", () => {
    const acces = calculerAcces(new Date(GRATUITE_EXISTANTS_JUSQUAU), etat({ statut: "canceled" }), maintenant)
    expect(acces.etat).toBe("gratuit-vie")
    for (const c of ["maraichage", "verger", "elevage", "comptabilite", "meteo", "ia", "boutique"] as const) expect(aCapacite(acces, c)).toBe(true)
  })
  it("ne transforme pas les inscrits après l’annonce en comptes gratuits à vie", () => {
    const d = new Date(Date.parse(GRATUITE_EXISTANTS_JUSQUAU) + 1)
    expect(calculerAcces(d, null, maintenant).etat).toBe("a-demarrer")
  })
  it("préserve les instances auto-hébergées sans activation commerciale", () => {
    expect(calculerAcces(nouveau, null, maintenant, false).etat).toBe("libre")
  })
  it.each(["maraichage", "verger", "elevage"] as const)("Essentiel n’ouvre que %s et exclut tous les services annoncés", atelier => {
    const acces = calculerAcces(nouveau, etat({ formule: "essentiel", atelier, statut: "active", payeJusquau: new Date("2027-04-01") }), maintenant)
    expect(acces.ateliers).toEqual([atelier])
    expect(acces.ecriture).toBe(true)
    for (const c of ["ia", "meteo", "boutique", "comptabilite"] as const) expect(aCapacite(acces, c)).toBe(false)
  })
  it("une formule Essentiel mal renseignée ne donne aucun droit payé", () => {
    expect(calculerAcces(nouveau, etat({ formule: "essentiel", atelier: "inventé", statut: "active", payeJusquau: new Date("2027-04-01") }), maintenant).ecriture).toBe(false)
  })
  it("le statut actif seul et un retour de paiement ne suffisent pas", () => {
    expect(calculerAcces(nouveau, etat({ formule: "complet", statut: "active" }), maintenant).ecriture).toBe(false)
  })
  it("conserve une période réglée après résiliation, sans prolongation implicite", () => {
    const a = etat({ formule: "complet", statut: "canceled", payeJusquau: new Date("2027-04-01") })
    expect(calculerAcces(nouveau, a, maintenant).etat).toBe("actif")
    expect(calculerAcces(nouveau, a, new Date("2027-04-01")).etat).toBe("lecture")
  })
  it("la grâce est bornée et ne vaut que pour un paiement de renouvellement en retard", () => {
    const a = etat({ formule: "complet", statut: "past_due", payeJusquau: new Date("2027-02-28"), graceJusquau: new Date("2027-03-07") })
    expect(calculerAcces(nouveau, a, maintenant).etat).toBe("grace")
    expect(calculerAcces(nouveau, a, new Date("2027-03-07")).ecriture).toBe(false)
  })
  it("ouvre tous les modules pendant l’essai et ferme l’écriture exactement à son terme", () => {
    const a = etat({ essaiFin: new Date("2027-03-02") })
    expect(calculerAcces(nouveau, a, maintenant).etat).toBe("essai")
    expect(calculerAcces(nouveau, a, new Date("2027-03-02")).etat).toBe("lecture")
  })
})
describe("trois mois calendaires", () => {
  it.each([["2026-11-08T20:32:07Z", "2027-02-08T20:32:07.000Z"], ["2026-08-31T10:30:00Z", "2026-11-30T10:30:00.000Z"], ["2027-11-30T12:00:00Z", "2028-02-29T12:00:00.000Z"]])("%s finit le %s", (debut, fin) => expect(finEssai(new Date(debut)).toISOString()).toBe(fin))
})
describe("contrôle serveur des chemins", () => {
  const acces = calculerAcces(nouveau, etat({ formule: "essentiel", atelier: "verger", statut: "active", payeJusquau: new Date("2027-04-01") }), maintenant)
  it("ne donne pas accès par lien direct aux services exclus", () => {
    for (const p of ["/api/chat", "/api/mcp", "/api/meteo", "/api/comptabilite/factures", "/api/boutique", "/comptabilite", "/meteo"]) expect(operationPermise(acces, p, "GET")).toBe(false)
  })
  it("refuse un autre atelier y compris une URL à extension image", () => {
    expect(operationPermise(acces, "/api/elevage/animaux/17.png", "DELETE")).toBe(false)
    expect(operationPermise(acces, "/api/arbres/17.png", "DELETE")).toBe(true)
  })
  it("n’autorise pas un import à contourner l’atelier choisi", () => {
    for (const p of ["/api/account/import", "/api/import", "/api/onboarding/configurer"]) expect(operationPermise(acces, p, "POST")).toBe(false)
  })
  it("garde récupération et réglages personnels sans ouvrir de nouvelles écritures", () => {
    const lecture = calculerAcces(nouveau, etat(), maintenant)
    expect(operationPermise(lecture, "/api/account/export", "GET")).toBe(true)
    expect(operationPermise(lecture, "/api/comptabilite/factures/1/pdf", "GET")).toBe(true)
    expect(operationPermise(lecture, "/api/user/preferences", "PUT")).toBe(true)
    expect(operationPermise(lecture, "/api/cultures", "POST")).toBe(false)
  })
})
