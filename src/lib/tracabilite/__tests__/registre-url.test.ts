import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { lireEtatTracabilite, lireRegistre, urlTracabilite } from "../registre-url"

/**
 * QA cmvntzwng (2026-10-25) : sur `/tracabilite`, « Registre de culture »
 * choisi (clic ou Entrée), puis F5 : retour au registre phytosanitaire, l'URL
 * restée `/tracabilite`. Le registre et l'année sont désormais dans l'URL.
 */

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")
const lireSource = (relatif: string) => fs.readFileSync(path.join(SRC, relatif), "utf-8")

const ANNEES = [2027, 2026, 2025, 2024, 2023, 2022]
const OPTIONS = { annees: ANNEES, anneeParDefaut: 2026 }

/** Ce que voit l'écran après un rechargement de cette URL. */
const recharger = (url: string) => lireEtatTracabilite(new URL(url, "https://gleba.fr").search, OPTIONS)

describe("registre de /tracabilite porté par l'URL", () => {
  it("rejoue le ticket : Registre de culture choisi, F5, toujours le registre de culture", () => {
    const arrivee = { pathname: "/tracabilite", search: "", hash: "" }
    expect(lireEtatTracabilite(arrivee.search, OPTIONS)).toEqual({ registre: "phyto", annee: 2026 })

    const url = urlTracabilite(arrivee, { registre: "culture", annee: 2026 })
    expect(url).toBe("/tracabilite?registre=culture&annee=2026")
    expect(recharger(url)).toEqual({ registre: "culture", annee: 2026 })
  })

  it("garde l'année choisie au rechargement", () => {
    const url = urlTracabilite(
      { pathname: "/tracabilite", search: "?registre=culture&annee=2026", hash: "" },
      { registre: "culture", annee: 2027 },
    )
    expect(url).toBe("/tracabilite?registre=culture&annee=2027")
    expect(recharger(url)).toEqual({ registre: "culture", annee: 2027 })
  })

  it("garde les autres paramètres et l'ancre", () => {
    expect(
      urlTracabilite(
        { pathname: "/tracabilite", search: "?source=compta&annee=2025", hash: "#imprimer" },
        { registre: "elevage", annee: 2025 },
      ),
    ).toBe("/tracabilite?source=compta&annee=2025&registre=elevage#imprimer")
  })

  it("une valeur inconnue ou une année hors plage retombent sur le défaut", () => {
    expect(lireRegistre("Registre de culture")).toBe("phyto")
    expect(lireRegistre("")).toBe("phyto")
    expect(lireRegistre(null)).toBe("phyto")
    expect(lireRegistre(" Culture ")).toBe("culture")
    expect(recharger("/tracabilite?registre=inconnu&annee=1999")).toEqual({ registre: "phyto", annee: 2026 })
    expect(recharger("/tracabilite?registre=sanitaire&annee=2027abc")).toEqual({ registre: "sanitaire", annee: 2026 })
  })

  it("la page lit l'URL au montage et l'écrit par l'API History, état null", () => {
    const page = lireSource("app/tracabilite/page.tsx")
    expect(page).toMatch(/lireEtatTracabilite\(\s*window\.location\.search\s*,/)
    expect(page).toMatch(/window\.history\.replaceState\(\s*null\s*,\s*""\s*,\s*urlTracabilite\(\s*window\.location\s*,/)
    // Le registre et l'année ne changent plus sans passer par l'URL.
    expect(page).not.toMatch(/onClick=\{\(\) => setActiveTab\(/)
    expect(page).not.toMatch(/onChange=\{\(e\) => setSelectedYear\(/)
    expect(page).not.toMatch(/router\.replace\(/)
    // La première lecture des données attend la restauration de l'URL.
    expect(page).toMatch(/if \(!session\?\.user \|\| !etatRestaure\) return/)
  })
})
