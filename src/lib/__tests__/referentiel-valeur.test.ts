import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { SENTINELLES_REFERENTIEL, valeurRenseignee } from "../referentiel-valeur"

/**
 * Ticket QA cmvnu7ad8 (2026-10-25) : « NON_TROUVE » affiché sous LEVÉE sur la
 * fiche publique du Pommier. Sentinelle des CSV d'enrichissement, copiée telle
 * quelle par l'import dans les colonnes texte vides.
 */

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")
const lire = (relatif: string) => fs.readFileSync(path.join(RACINE, relatif), "utf-8")

describe("valeurRenseignee", () => {
  it("une sentinelle d'import se lit absente", () => {
    expect(valeurRenseignee("NON_TROUVE")).toBeNull()
    expect(valeurRenseignee(" non_trouve ")).toBeNull()
    expect(valeurRenseignee("NON_TROUVE (Variété sélectionnée)\nSource: catalogue")).toBeNull()
    expect(valeurRenseignee("INCONNU")).toBeNull()
    expect(valeurRenseignee("n/a")).toBeNull()
  })

  it("vide ou absent : null ; une vraie valeur reste, rognée", () => {
    expect(valeurRenseignee(null)).toBeNull()
    expect(valeurRenseignee(undefined)).toBeNull()
    expect(valeurRenseignee("   ")).toBeNull()
    expect(valeurRenseignee(" 15-25°C ")).toBe("15-25°C")
    // Un texte qui commence par le mot n'est pas une sentinelle.
    expect(valeurRenseignee("Inconnu en France avant le XVIe siècle.")).toBe("Inconnu en France avant le XVIe siècle.")
    expect(valeurRenseignee("Non trouvée en jardinerie, semences à commander.")).toBe(
      "Non trouvée en jardinerie, semences à commander.",
    )
  })

  it("toutes les sentinelles des CSV d'enrichissement sont reconnues", () => {
    for (const fichier of ["especes_enriched.csv", "varietes_enriched.csv"]) {
      const cellules = lire(fichier).match(/NON_TROUVE[^",\n]*/g) ?? []
      expect(cellules.length).toBeGreaterThan(0)
      for (const cellule of new Set(cellules)) expect(valeurRenseignee(cellule)).toBeNull()
    }
  })

  it("l'import des CSV applique la même liste à chaque cellule", () => {
    const script = lire("scripts/import-enriched-csv.ts")
    const liste = script.match(/const SENTINELLES_IMPORT = \[([^\]]*)\]/)
    expect(liste).not.toBeNull()
    const sentinelles = [...liste![1].matchAll(/'([^']+)'/g)].map((m) => m[1])
    expect(sentinelles).toEqual([...SENTINELLES_REFERENTIEL])
    expect(script).toMatch(/row\[header\] = celluleCsv\(values\[idx\]\)/)
    // Une sentinelle déjà en base compte pour vide : une vraie valeur du CSV la
    // remplace au démarrage suivant (`champsAComplete`).
    expect(script).toMatch(
      /if \(actuel === null \|\| actuel === undefined \|\| celluleCsv\(String\(actuel\)\) === null\) retenus\[champ\] = valeur/,
    )
    expect(script).toContain("const NON_TROUVE_EN_TETE = /^NON_TROUV[EÉ](?![A-Za-zÀ-ÿ0-9_])/i")
    expect(lire("src/lib/referentiel-valeur.ts")).toContain(
      "const NON_TROUVE_EN_TETE = /^NON_TROUV[EÉ](?![A-Za-zÀ-ÿ0-9_])/i",
    )
  })
})
