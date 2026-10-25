import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { lienOperationsArbre, lireArbreOuverture, operationsDeLArbre } from "../lien-operations-arbre"

/**
 * QA cmvnorxov (2026-10-25) : sur `/verger/881`, onglet Opérations, « Voir les
 * opérations » menait à `/verger?tab=operations` sans filtre : 31 opérations
 * de tous les arbres au lieu de celles de l'arbre 881.
 */

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")
const lireSource = (relatif: string) => fs.readFileSync(path.join(SRC, relatif), "utf-8")

describe("opérations d'un arbre depuis sa fiche", () => {
  it("le lien de la fiche porte l'identifiant de l'arbre et l'année", () => {
    expect(lienOperationsArbre(881, 2026)).toBe("/verger?tab=operations&arbreId=881&annee=2026")
  })

  it("l'onglet relit l'identifiant et nettoie l'URL en gardant l'onglet et l'année", () => {
    const { search } = new URL(lienOperationsArbre(881, 2026), "https://gleba.fr")
    expect(lireArbreOuverture(search)).toEqual({ arbreId: 881, requete: "tab=operations&annee=2026" })
  })

  it("retire un identifiant invalide sans filtrer, et ne touche pas une URL sans paramètre", () => {
    expect(lireArbreOuverture("?tab=operations&arbreId=Pommier")).toEqual({ arbreId: null, requete: "tab=operations" })
    expect(lireArbreOuverture("?tab=operations&arbreId=0")).toEqual({ arbreId: null, requete: "tab=operations" })
    expect(lireArbreOuverture("?tab=operations")).toEqual({ arbreId: null, requete: null })
  })

  it("filtre par identifiant, pas par nom : deux arbres homonymes restent distincts", () => {
    const operations = [
      { id: 1, arbreId: 881, arbre: { nom: "Pommier" } },
      { id: 2, arbreId: 882, arbre: { nom: "Pommier" } },
      { id: 3, arbreId: 881, arbre: { nom: "Pommier" } },
      { id: 4, arbreId: 12, arbre: { nom: "Noyer" } },
    ]
    expect(operationsDeLArbre(operations, 881).map((op) => op.id)).toEqual([1, 3])
    expect(operationsDeLArbre(operations, null)).toHaveLength(4)
  })

  it("la fiche et l'onglet passent par ce module, le nettoyage par l'API History", () => {
    const fiche = lireSource("app/verger/[id]/page.tsx")
    expect(fiche).toMatch(/lienOperationsArbre\(\s*arbre\.id\s*,/)
    expect(fiche).not.toMatch(/href="\/verger\?tab=operations"/)

    const onglet = lireSource("components/verger/OperationsTab.tsx")
    expect(onglet).toMatch(/lireArbreOuverture\(\s*window\.location\.search\s*\)/)
    expect(onglet).toMatch(/updateDashboardSearchParams\(\s*new URLSearchParams\(\s*requete\s*\)\s*,\s*"replace"\s*\)/)

    // État `null`, pas celui de Next (motif 7).
    expect(lireSource("lib/dashboard-navigation.ts")).toMatch(/replaceState\(\s*null,/)
  })
})
