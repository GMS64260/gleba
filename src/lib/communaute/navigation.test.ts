import { describe, expect, it } from "vitest"
import { lireOngletCommunaute, urlOngletCommunaute } from "./navigation"
import { cheminDeRetour, urlConnexion } from "@/lib/auth-retour"

describe("navigation de la communauté", () => {
  it("ouvre l’encyclopédie par défaut et conserve les anciens onglets explicites", () => {
    expect(lireOngletCommunaute(null)).toBe("encyclopedie")
    expect(lireOngletCommunaute("inconnu")).toBe("encyclopedie")
    for (const onglet of ["salon", "roadmap", "propositions", "contribuer"] as const) expect(lireOngletCommunaute(onglet)).toBe(onglet)
  })

  it("garde filtres et sujet lors d’un changement d’onglet", () => {
    const url = new URL(urlOngletCommunaute("salon", "q=tomate&sujet=identifiant-stable&tab=encyclopedie"), "https://gleba.test")
    expect(url.searchParams.get("tab")).toBe("salon")
    expect(url.searchParams.get("sujet")).toBe("identifiant-stable")
    expect(url.searchParams.get("q")).toBe("tomate")
  })

  it("le retour de connexion conserve l’onglet et le sujet sans changer d’origine", () => {
    const chemin = urlOngletCommunaute("salon", "sujet=identifiant-stable&forumCategorie=ENTRAIDE")
    const connexion = new URL(urlConnexion(chemin), "https://gleba.test")
    expect(cheminDeRetour(connexion.searchParams.get("callbackUrl"))).toBe(chemin)
  })
})
