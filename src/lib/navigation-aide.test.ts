import { existsSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { CIBLES_AIDE, cibleAide, cheminAide, ciblesAideDansTexte } from "./navigation-aide"

describe("parcours d’aide", () => {
  it("pointe vers des pages existantes, y compris les pages publiques et les onglets", () => {
    for (const cible of CIBLES_AIDE) {
      // La boutique est une fonctionnalité optionnelle livrée hors du dépôt public.
      if (cible.menu === "boutique") continue
      const route = cible.href.split("?")[0].slice(1)
      expect(["src/app", "src/app/(auth)"].some(racine => existsSync(path.join(process.cwd(), racine, route, "page.tsx"))), cible.href).toBe(true)
    }
  })

  it("part du vrai menu Interventions pour le registre phyto", () => {
    expect(cheminAide(cibleAide("/tracabilite")!)).toBe("Interventions › Registre phyto complet")
    expect(cibleAide("/parametres?rubrique=abonnement")?.suite).toBe("Abonnement")
  })

  it("n’active que les liens exacts du catalogue et les déduplique", () => {
    expect(ciblesAideDansTexte("[Registre](/tracabilite), puis `/tracabilite`.").map(cible => cible.href)).toEqual(["/tracabilite"])
    expect(ciblesAideDansTexte("[Production](/verger?tab=productions)")[0]?.href).toBe("/verger?tab=productions")
    expect(ciblesAideDansTexte("Ouvrez /parametres?rubrique=abonnement.")[0]?.libelle).toBe("Abonnement")
  })

  it.each(["javascript:alert(1)", "//example.test/tracabilite", "https://example.test/tracabilite", "../tracabilite", "/api/user/delete-data", "/tracabilite?compte=autre", "/tracabilite#inconnu", "/verger/123", "/mes-signalements"])("refuse la destination %s", href => {
    expect(cibleAide(href)).toBeUndefined()
    expect(ciblesAideDansTexte(href)).toEqual([])
  })
})
