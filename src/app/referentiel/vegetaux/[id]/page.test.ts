import { beforeEach, describe, expect, it, vi } from "vitest"
import { createElement, type ReactNode } from "react"
import { renderToString } from "react-dom/server"
import { SessionProvider } from "next-auth/react"

/**
 * Ticket QA cmvnu7ad8 (2026-10-25) : `/referentiel/vegetaux/Pommier` affichait
 * « NON_TROUVE » sous LEVÉE. La ligne du Pommier porte la sentinelle de
 * l'enrichissement automatique dans `temp_germination` (aucun nombre de jours
 * de levée), que la carte « Levée » affichait en repli.
 */

const mocks = vi.hoisted(() => ({ especeFindFirst: vi.fn(), lireCommunaute: vi.fn() }))

vi.mock("@/lib/encyclopedie/service", () => ({
  lireCommunauteVegetal: mocks.lireCommunaute,
  ErreurEncyclopedie: class extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status } },
}))
vi.mock("@/lib/prisma", () => ({ default: { espece: { findFirst: mocks.especeFindFirst } } }))
// React 18 renderToString ne déroule pas les Server Components asynchrones.
// Les branches de navigation sont vérifiées dans ReferentielShell.test.ts.
vi.mock("@/components/referentiel/ReferentielShell", () => ({
  ReferentielShell: ({ children }: { children: ReactNode }) => children,
}))
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound")
  },
  usePathname: () => "/referentiel/vegetaux/Pommier",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {} }),
}))

import FicheVegetalPage from "./page"

/** Ligne du Pommier telle que l'import des CSV enrichis l'a laissée. */
const POMMIER = {
  id: "Pommier",
  nom: "Pommier",
  nomLatin: "Malus domestica",
  type: "arbre_fruitier",
  description: null,
  userId: null,
  vivace: true,
  besoinEau: null,
  besoinFroid: "INCONNU",
  zonesAdaptees: "NON_TROUVE",
  densite: null,
  temperatureGerm: "NON_TROUVE",
  joursLevee: null,
  irrigation: "Moyen",
  famille: { id: "Rosacées", nomFr: "Rosacées" },
  varietes: [
    {
      id: "Pommier Reine des Reinettes",
      nom: "Reine des Reinettes",
      userId: null,
      bio: false,
      semaineRecolte: null,
      dureeRecolte: null,
      semaineFloraison: null,
      dureeFloraison: null,
      groupePollinisation: "N/A",
      ploidie: null,
    },
  ],
  _count: { itps: 0 },
  itps: [],
  medias: [],
}

async function rendreFiche(): Promise<string> {
  const page = await FicheVegetalPage({ params: Promise.resolve({ id: "Pommier" }) })
  return renderToString(createElement(SessionProvider, null, page))
}

describe("/referentiel/vegetaux/Pommier : sentinelle d'import jamais affichée", () => {
  beforeEach(() => {
    mocks.especeFindFirst.mockReset()
    mocks.especeFindFirst.mockResolvedValue(POMMIER)
    mocks.lireCommunaute.mockResolvedValue({ sections: [], revisions: [], discussions: [] })
  })

  it("rejoue le ticket : sous LEVÉE, « À documenter » et non « NON_TROUVE »", async () => {
    const html = await rendreFiche()

    expect(html).not.toContain("NON_TROUVE")
    expect(html).toMatch(/>Levée<\/div><div[^>]*>À documenter<\/div>/)
  })

  it("aucune autre caractéristique n'affiche de sentinelle", async () => {
    const html = await rendreFiche()

    expect(html).not.toMatch(/INCONNU|N\/A/)
    expect(html).toContain("Zones adaptées encore non documentées.")
    expect(html).not.toContain("Besoin de froid")
    expect(html).not.toContain("Groupe de floraison")
    // Les vraies valeurs restent.
    expect(html).toContain("Rosacées")
    expect(html).toContain("Moyen")
  })
})


describe("fiche contributive : contenus publiés et références", () => {
  beforeEach(() => {
    mocks.especeFindFirst.mockResolvedValue(POMMIER)
    mocks.lireCommunaute.mockResolvedValue({
      sections: [{ section: "semis", contenu: "Un passage communautaire relu, servi dès le rendu HTML.", source: "https://example.org/reference", revisionId: "revision-publique", version: 1, signature: "Signature choisie", createdAt: "2026-10-26T10:00:00.000Z", licence: "CC BY 4.0" }],
      revisions: [], discussions: [],
    })
  })

  it("sert les textes relus dans le HTML sans attendre le chargement du client", async () => {
    const html = await rendreFiche()
    expect(html).toContain("Un passage communautaire relu, servi dès le rendu HTML.")
    expect(html).toContain("Signature choisie")
    expect(html).toContain('href="https://example.org/reference"')
    expect(html).toContain('id="communaute-fiche"')
    expect(html).toContain("Images documentaires")
    expect(html).toContain("Itinéraires techniques par contexte")
  })
})
