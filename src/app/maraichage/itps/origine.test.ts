// @vitest-environment jsdom
import * as React from "react"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { CellContext, ColumnDef } from "@tanstack/react-table"
import ITPsPage from "./page"
import EditITPPage from "./[id]/page"

const m = vi.hoisted(() => ({ toast: vi.fn(), router: { push: vi.fn() } }))
vi.mock("next/navigation", () => ({ useRouter: () => m.router, useParams: () => ({ id: "itp-ferme" }) }))
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: { user: { id: "membre-fictif", role: "USER" } }, status: "authenticated" }) }))
vi.mock("@/hooks/use-exploitation", () => ({ useExploitation: () => ({ contexte: { tenantId: "ferme-fictive" } }) }))
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: m.toast }) }))
vi.mock("@/components/shell/AppHeader", () => ({
  AppHeader: () => null,
  PageToolbar: ({ children }: { children: React.ReactNode }) => React.createElement("header", null, children),
}))
vi.mock("@/components/avis/AvisDialog", () => ({ AvisDialog: () => null }))
vi.mock("@/components/tables/DataTable", () => ({
  DataTable: function DataTable<T>({ data, columns }: { data: T[]; columns: ColumnDef<T>[] }) {
    const cell = columns.find((c) => c.id === "origine")?.cell
    return React.createElement("div", null, data.map((original, index) => React.createElement("div", { key: index },
      typeof cell === "function" ? cell({ row: { original } } as CellContext<T, unknown>) : null,
    )))
  },
}))

const itp = {
  id: "itp-ferme", nom: "Laitue de la ferme", userId: "ferme-fictive", origine: "perso",
  partageCommunaute: true, especeId: null, espece: null, sourceRecordId: null,
  actif: true, statutValidation: "COMMUNAUTE", _count: { cultures: 0, rotationsDetails: 0 },
}
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    let data: unknown
    if (url.startsWith("/api/itps?")) data = { data: [itp], totalPages: 1 }
    else if (url === "/api/itps/itp-ferme") data = itp
    else if (url.startsWith("/api/especes?")) data = { data: [] }
    else if (url === "/api/calendrier-climat") data = { zone: null }
    else throw new Error(`Requête inattendue : ${url}`)
    return { ok: true, json: async () => data } as Response
  }))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe("ITP du propriétaire vu par un membre", () => {
  it("affiche Perso dans la liste grâce à l’origine renvoyée par l’API", async () => {
    render(React.createElement(ITPsPage))
    expect(await screen.findByText("Perso")).toBeDefined()
    expect(screen.queryByText("Communauté")).toBeNull()
  })

  it("affiche Perso sur la fiche grâce au propriétaire du contexte d’exploitation", async () => {
    render(React.createElement(EditITPPage))
    expect(await screen.findByText("Perso")).toBeDefined()
    expect(screen.queryByText("Communauté")).toBeNull()
    expect(screen.getByText("Itinéraire personnel de l’exploitation : consultable mais non modifiable ici.")).toBeDefined()
  })
})
