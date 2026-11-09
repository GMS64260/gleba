import { describe, expect, it } from "vitest"
import { calculerAcces, finEssai, aCapacite, type EtatAbonnement } from "./politique"
import { GRATUITE_EXISTANTS_JUSQUAU } from "./catalogue"
import { capaciteDuChemin, operationPermise, PAGES_PROTEGEES } from "./requetes"
const maintenant = new Date("2027-03-01T12:00:00Z")
const nouveau = new Date("2026-11-09T00:00:00Z")
const etat = (overrides: Partial<EtatAbonnement> = {}): EtatAbonnement => ({ gratuitAVie: false, essaiDebut: new Date("2026-11-09"), essaiFin: new Date("2027-02-09"), formule: null, statut: null, payeJusquau: null, graceJusquau: null, ...overrides })
const PAYANTES = ["ia", "meteo", "boutique", "gestion"] as const
const GRATUITES = ["maraichage", "verger", "elevage", "facturation", "commun"] as const
describe("droits du service hébergé", () => {
  it("conserve la gratuité complète à vie à la borne exacte, même après annulation ou fin d’essai", () => {
    const acces = calculerAcces(new Date(GRATUITE_EXISTANTS_JUSQUAU), etat({ statut: "canceled" }), maintenant)
    expect(acces.etat).toBe("gratuit-vie")
    for (const c of [...GRATUITES, ...PAYANTES]) expect(aCapacite(acces, c)).toBe(true)
  })
  it("ne transforme pas les inscrits après l’annonce en comptes gratuits à vie", () => {
    const d = new Date(Date.parse(GRATUITE_EXISTANTS_JUSQUAU) + 1)
    expect(calculerAcces(d, null, maintenant).etat).toBe("a-demarrer")
  })
  it("préserve les instances auto-hébergées sans activation commerciale", () => {
    expect(calculerAcces(nouveau, null, maintenant, false).etat).toBe("libre")
  })
  it("le carnet gratuit garde tous les ateliers et la facturation, sans les services de Complet", () => {
    for (const acces of [calculerAcces(nouveau, null, maintenant), calculerAcces(nouveau, etat(), maintenant)]) {
      expect(["a-demarrer", "gratuit"]).toContain(acces.etat)
      for (const c of GRATUITES) expect(aCapacite(acces, c)).toBe(true)
      for (const c of PAYANTES) expect(aCapacite(acces, c)).toBe(false)
    }
  })
  it("le statut actif seul et un retour de paiement ne suffisent pas", () => {
    const acces = calculerAcces(nouveau, etat({ formule: "complet", statut: "active" }), maintenant)
    expect(acces.etat).toBe("gratuit")
    expect(acces.ia).toBe(false)
  })
  it("une formule inconnue ne donne aucun service payant", () => {
    expect(calculerAcces(nouveau, etat({ formule: "essentiel", statut: "active", payeJusquau: new Date("2027-04-01") }), maintenant).gestion).toBe(false)
  })
  it("conserve une période réglée après résiliation, puis revient au carnet gratuit", () => {
    const a = etat({ formule: "complet", statut: "canceled", payeJusquau: new Date("2027-04-01") })
    expect(calculerAcces(nouveau, a, maintenant).etat).toBe("actif")
    const apres = calculerAcces(nouveau, a, new Date("2027-04-01"))
    expect(apres.etat).toBe("gratuit")
    expect(apres.ecriture).toBe(true)
  })
  it("la grâce est bornée et ne vaut que pour un paiement de renouvellement en retard", () => {
    const a = etat({ formule: "complet", statut: "past_due", payeJusquau: new Date("2027-02-28"), graceJusquau: new Date("2027-03-07") })
    expect(calculerAcces(nouveau, a, maintenant).etat).toBe("grace")
    expect(calculerAcces(nouveau, a, new Date("2027-03-07")).ia).toBe(false)
  })
  it("ouvre Complet pendant l’essai et revient au gratuit exactement à son terme", () => {
    const a = etat({ essaiFin: new Date("2027-03-02") })
    expect(calculerAcces(nouveau, a, maintenant).etat).toBe("essai")
    expect(calculerAcces(nouveau, a, maintenant).gestion).toBe(true)
    expect(calculerAcces(nouveau, a, new Date("2027-03-02")).etat).toBe("gratuit")
  })
})
describe("trois mois calendaires", () => {
  it.each([["2026-11-08T20:32:07Z", "2027-02-08T20:32:07.000Z"], ["2026-08-31T10:30:00Z", "2026-11-30T10:30:00.000Z"], ["2027-11-30T12:00:00Z", "2028-02-29T12:00:00.000Z"]])("%s finit le %s", (debut, fin) => expect(finEssai(new Date(debut)).toISOString()).toBe(fin))
})
describe("contrôle serveur des chemins", () => {
  const gratuit = calculerAcces(nouveau, etat(), maintenant)
  it("ne donne pas accès par lien direct aux services de Complet", () => {
    for (const p of ["/api/chat", "/api/mcp", "/api/meteo", "/api/boutique", "/meteo", "/comptabilite", "/api/comptabilite/stats", "/api/comptabilite/banque", "/api/comptabilite/tva", "/api/comptabilite/depenses-manuelles", "/comptabilite/banque"]) expect(operationPermise(gratuit, p, "GET")).toBe(false)
    expect(operationPermise(gratuit, "/api/comptabilite/banque", "POST")).toBe(false)
  })
  it("garde tous les ateliers et la facturation dans le carnet gratuit", () => {
    for (const p of ["/api/cultures", "/api/arbres/17", "/api/elevage/animaux", "/api/comptabilite/factures", "/api/comptabilite/documents", "/api/comptabilite/clients", "/api/comptabilite/reglements", "/api/comptabilite/ventes-manuelles", "/api/account/import"]) expect(operationPermise(gratuit, p, "POST")).toBe(true)
    for (const p of ["/comptabilite/factures", "/comptabilite/clients", "/comptabilite/fournisseurs"]) expect(operationPermise(gratuit, p, "GET")).toBe(true)
  })
  it("ne confond pas un préfixe voisin avec la facturation", () => {
    expect(operationPermise(gratuit, "/api/comptabilite/facturesx", "GET")).toBe(false)
  })
  it("garde récupération et réglages personnels", () => {
    expect(operationPermise(gratuit, "/api/account/export", "GET")).toBe(true)
    expect(operationPermise(gratuit, "/api/comptabilite/export", "GET")).toBe(true)
    expect(operationPermise(gratuit, "/api/comptabilite/factures/1/pdf", "GET")).toBe(true)
    expect(operationPermise(gratuit, "/api/user/preferences", "PUT")).toBe(true)
    expect(operationPermise(gratuit, "/api/comptabilite/export", "POST")).toBe(false)
  })
})
describe("pages protégées", () => {
  const pages = PAGES_PROTEGEES.source.match(/\(([^)]+)\)/)![1].split("|")
  it.each(pages)("/%s a une capacité connue et reste ouverte au carnet gratuit si c’est un atelier ou une page commune", page => {
    expect(capaciteDuChemin("/" + page)).not.toBe("inconnu")
  })
  it("l’accueil Aujourd’hui est ouvert à tous les accès", () => {
    for (const acces of [calculerAcces(nouveau, null, maintenant, false), calculerAcces(nouveau, etat(), maintenant), calculerAcces(new Date(GRATUITE_EXISTANTS_JUSQUAU), null, maintenant)]) {
      expect(operationPermise(acces, "/aujourdhui", "GET")).toBe(true)
    }
  })
})
