import { describe, expect, it, vi } from "vitest"
import { isValidElement, type ReactElement, type ReactNode } from "react"
import type { ColumnDef, CellContext } from "@tanstack/react-table"

const m = vi.hoisted(() => ({ etats: [] as unknown[], index: 0, devise: "XPF" as string | null }))
// Rendu des vrais composants avec leurs données chargées ; les enfants UI
// ne sont pas exécutés. Les cellules du DataTable sont vérifiées séparément.
vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>()
  return {
    ...react,
    useState: (initial: unknown) => {
      const index = m.index++
      return [index < m.etats.length ? m.etats[index] : typeof initial === "function" ? initial() : initial, vi.fn()]
    },
    useEffect: vi.fn(),
    useMemo: (fn: () => unknown) => fn(),
    useCallback: (fn: unknown) => fn,
    useRef: (value: unknown) => ({ current: value }),
  }
})
vi.mock("@/hooks/use-devise", () => ({ useDevise: () => m.devise }))
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock("@/hooks/use-exploitation", () => ({ useExploitation: () => ({ peutEcrire: true }) }))
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: { user: { id: "acteur-fictif" } }, status: "authenticated" }) }))
vi.mock("next/navigation", () => ({ useRouter: () => ({}), usePathname: () => "/verger", useSearchParams: () => new URLSearchParams() }))
vi.mock("lucide-react", () => import("@/lib/phosphor-icons"))

import Recoltes from "./maraichage/recoltes/page"
import { ProductionTab } from "@/components/elevage/ProductionTab"
import { TableRow } from "@/components/ui/table"
import Economie from "./elevage/economie/page"
import { OperationsTab } from "@/components/verger/OperationsTab"
import { DataTable } from "@/components/tables/DataTable"

function texte(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(texte).join(" ")
  if (!isValidElement<{ children?: ReactNode }>(node)) return ""
  return texte(node.props.children)
}
function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!isValidElement<Record<string, unknown>>(node)) return []
  return [node, ...elements(node.props.children as ReactNode)]
}
const normaliser = (texte: string) => texte.replace(/[\u00a0\u202f]/g, " ")
const operation = { id: 1, arbreId: 1, date: "2026-07-10", datePrevue: null, fait: true, cout: 1234.56, arbre: { id: 1, nom: "Pommier fictif" } }
const analyse = {
  stats: { totalCouts: 1234.56, totalRevenus: 2500, margeGlobale: 1265.44 },
  ateliers: [{ code: "ponte", libelle: "Poules", effectif: 12, couts: { total: 1234.56 }, revenus: { total: 2500 }, marge: 1265.44, metriques: { coutParOeuf: 0.123 } }],
  rapprochementLait: [{ mois: 1, litresLivres: 1000, litresPayes: 1000, ecartLitres: 0, montantHT: 1234.56, statut: "ok" }],
  methode: {},
}
const surfaces = [
  { nom: "Économie de l’élevage (cartes, ateliers, paies)", rendre: () => Economie(), etats: [2026, analyse, false] },
  { nom: "Verger (total annuel, réalisé et prévu)", rendre: () => OperationsTab({ annee: 2026 }), etats: [[operation, { ...operation, id: 2, cout: 100, fait: false }], [], false] },
]

describe.each(surfaces)("devise des écrans B4 — $nom", ({ rendre, etats }) => {
  it.each([["XPF", "F"], ["EUR", "€"]])("affiche la devise %s", (devise, symbole) => {
    m.devise = devise
    m.etats = etats
    m.index = 0
    const rendu = normaliser(texte(rendre()))
    expect(rendu).toContain(devise === "XPF" ? "1 235 F" : "1 234,56 €")
    expect(rendu).toContain(symbole)
    if (devise === "XPF") expect(rendu).not.toContain("€")
  })
  it("ne suppose pas EUR pendant le chargement ou après une erreur de devise", () => {
    m.devise = null
    m.etats = etats
    m.index = 0
    const rendu = texte(rendre())
    expect(rendu).toContain("—")
    expect(rendu).not.toMatch(/€|\d[\u00a0\u202f ]F/)
  })
})

it("préserve les millièmes des coûts unitaires en EUR", () => {
  m.devise = "EUR"
  m.etats = [2026, analyse, false]
  m.index = 0
  expect(normaliser(texte(Economie()))).toContain("0,123 € / œuf")
})

it.each([["XPF", "1 235 F"], ["EUR", "1 234,56 €"], [null, "—"]])("formate la colonne des opérations en %s", (devise, attendu) => {
  m.devise = devise
  m.etats = [[operation], [], false]
  m.index = 0
  const table = elements(OperationsTab({ annee: 2026 })).find(e => e.type === DataTable)
  const colonnes = table?.props.columns as ColumnDef<unknown>[]
  const cout = colonnes.find(c => "accessorKey" in c && c.accessorKey === "cout")
  const cellule = cout?.cell as (context: CellContext<unknown, unknown>) => ReactNode
  expect(normaliser(texte(cellule({ getValue: () => operation.cout } as CellContext<unknown, unknown>)))).toBe(attendu)
})


describe("ventes : devise figée et devise inconnue", () => {
  const vente = { id: 31, type: "oeufs", date: "2026-11-16", unite: "douzaine", quantite: 1, prixUnitaire: 1234.56, prixTotal: 1234.56, tauxTVA: 5.5, paye: true, notes: null }
  function rendreElevage(identite: object) {
    m.devise = "XPF"
    m.etats = []
    m.index = 0
    const composant = elements(ProductionTab()).find(e => typeof e.type === "function" && e.type.name === "VentesSubTab")
    expect(composant).toBeDefined()
    m.etats = [false, "exercice", [{ ...vente, ...identite }], { totalVentes: 1234.56, nbVentes: 1 }]
    m.index = 0
    return (composant!.type as () => ReactNode)()
  }
  function rendreRecoltes(identite: object) {
    m.devise = "XPF"
    m.etats = [[{ ...vente, ...identite, cultureId: 1, especeId: "carotte", espece: { nom: "Carotte" }, statut: "vendu", prixKg: 1234.56 }], [], false, false, "vendu"]
    m.index = 0
    return Recoltes()
  }
  for (const [nom, rendre] of [["élevage", rendreElevage], ["récoltes", rendreRecoltes]] as const) {
    it.each([[{ monnaie: "EUR" }, "1 234,56 €"], [{ factureId: 8, emetteurSnapshot: { devise: "EUR" } }, "1 234,56 €"], [{ factureId: 8 }, "—"], [{}, "1 235 F"]])(`${nom} : respecte %j`, (identite, attendu) => {
      const arbre = rendre(identite)
      const ligne = elements(arbre).find(e => e.type === TableRow && e.key === "31")
      expect(ligne).toBeDefined()
      expect(normaliser(texte(ligne))).toContain(attendu)
      if ("factureId" in identite || "monnaie" in identite) expect(texte(arbre)).not.toMatch(/1[\u00a0\u202f ]235 F/)
    })
  }
})
