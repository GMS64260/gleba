/**
 * Pages prérendues au build : le HTML servi est celui de l'instant du build,
 * l'hydratation a lieu à l'instant de la visite. Rien du premier rendu ne doit
 * dépendre du jour (2026-10-25). Sur /tracabilite, « Document généré le
 * 23/10/2026 » servi le 25 est un texte : React #418 « text ». Sur la saisie
 * des récoltes, value="2026-10-23" est un attribut : pas de #418, mais la date
 * du build est affichée dans le champ jusqu'à ce que React le reprenne.
 *
 * Sans DOM, le premier rendu client est approché par un second rendu serveur à
 * un autre instant : comme l'hydratation, il prend les états initiaux et les
 * snapshots serveur (`useSyncExternalStore`) et n'exécute aucun effet. Même
 * motif que `Accueil.hydratation.test.ts`.
 *
 * Hors champ : l'année de /tracabilite (sélecteur et titre imprimé) vient de
 * `getAvailableYears()`, calculée au chargement du module et partagée par neuf
 * pages ; elle ne diverge qu'entre une image construite une année et visitée
 * la suivante. Les instants ci-dessous restent donc dans la même année.
 */

import { afterEach, describe, expect, it, vi } from "vitest"
import { createElement, type ComponentType } from "react"
import { renderToString } from "react-dom/server"
import { SessionProvider } from "next-auth/react"

import TracabilitePage from "./tracabilite/page"
import SaisieRecoltePage from "./maraichage/recoltes/saisie/page"

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {} }),
}))

function rendreA(Page: ComponentType, instant: Date): string {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(instant)
  try {
    return renderToString(createElement(SessionProvider, null, createElement(Page)))
  } finally {
    vi.useRealTimers()
  }
}

afterEach(() => {
  vi.useRealTimers()
})

// Heure locale du processus (Europe/Paris dans le conteneur).
const BUILD = new Date(2026, 9, 23, 15, 31, 0)
const VISITE = new Date(2026, 9, 25, 11, 0, 0)
const AVANT_MINUIT = new Date(2026, 9, 24, 23, 59, 59)
const APRES_MINUIT = new Date(2026, 9, 25, 0, 0, 0)

describe("/tracabilite : premier rendu indépendant du jour", () => {
  it("HTML du build = premier rendu client deux jours plus tard, sans date d'édition", () => {
    const build = rendreA(TracabilitePage, BUILD)
    expect(rendreA(TracabilitePage, VISITE)).toBe(build)
    expect(build).toContain("print-header")
    expect(build).toContain("Imprimer / PDF")
    expect(build).not.toContain("Document généré le")
    expect(build).not.toMatch(/\d{2}\/10\/2026/)
  })

  it("passage de minuit entre le serveur et le client : même HTML", () => {
    expect(rendreA(TracabilitePage, APRES_MINUIT)).toBe(rendreA(TracabilitePage, AVANT_MINUIT))
  })
})

describe("/maraichage/recoltes/saisie : date initiale posée après montage", () => {
  it("HTML du build = premier rendu client deux jours plus tard, champ date vide", () => {
    const build = rendreA(SaisieRecoltePage, BUILD)
    expect(rendreA(SaisieRecoltePage, VISITE)).toBe(build)
    expect(build).not.toContain("2026-10-23")
    expect(build).toMatch(/id="saisie-recolte-date"[^>]*value=""/)
  })

  it("passage de minuit entre le serveur et le client : même HTML", () => {
    expect(rendreA(SaisieRecoltePage, APRES_MINUIT)).toBe(rendreA(SaisieRecoltePage, AVANT_MINUIT))
  })
})
