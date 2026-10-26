/**
 * `/aujourdhui` est prérendue au build (page statique) : le HTML servi est
 * celui de l'instant du build, l'hydratation a lieu à l'instant de la visite.
 * Tout texte du premier rendu qui dépend de l'horloge diverge alors
 * (React #418 « text », signalement du 2026-10-25 : « Vendredi 23 octobre »
 * figé au build du 23, « Dimanche 25 octobre » au client le 25).
 *
 * Sans DOM dans ces tests, le premier rendu client est approché par un second
 * rendu serveur à un autre instant : comme l'hydratation, il prend les états
 * initiaux et les snapshots serveur (`useSyncExternalStore`) et n'exécute
 * aucun effet. Les deux HTML doivent être identiques.
 */

import { afterEach, describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { SessionProvider } from "next-auth/react"

import { Accueil } from "./Accueil"

// Hors du routeur de Next : le chemin du prérendu et un routeur inerte.
vi.mock("next/navigation", () => ({
  usePathname: () => "/aujourdhui",
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {} }),
}))

function rendreA(instant: string | Date): string {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(typeof instant === "string" ? new Date(instant) : instant)
  try {
    // Comme dans le layout racine : session non encore connue au prérendu.
    return renderToString(createElement(SessionProvider, null, createElement(Accueil)))
  } finally {
    vi.useRealTimers()
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe("Accueil : premier rendu indépendant de l'horloge", () => {
  it("HTML du build (23/10) = premier rendu client deux jours plus tard (25/10)", () => {
    const build = rendreA("2026-10-23T13:31:00Z")
    const visite = rendreA("2026-10-25T10:00:00Z")
    expect(visite).toBe(build)
    expect(build).not.toMatch(/octobre/)
    // Le titre de navigation reste stable ; la date est une métadonnée chargée au client.
    expect(build).toMatch(/<h1[^>]*>Aujourd’hui<\/h1>/)
    expect(build).not.toContain("<time")
    // La rangée de repères est bien rendue, sans année figée.
    expect(build).toContain("Récoltes")
    expect(build).not.toContain("Récoltes 2026")
  })

  // Heure locale du processus (Europe/Paris dans le conteneur), quel que soit
  // le fuseau de la machine qui lance les tests.
  it("serveur à 23:59:59 et client à 00:00:00 le lendemain (heure locale) : même HTML", () => {
    expect(rendreA(new Date(2026, 9, 25, 0, 0, 0))).toBe(rendreA(new Date(2026, 9, 24, 23, 59, 59)))
  })

  it("passage d'année entre le serveur et le client (heure locale) : même HTML", () => {
    expect(rendreA(new Date(2027, 0, 1, 0, 0, 0))).toBe(rendreA(new Date(2026, 11, 31, 23, 59, 59)))
  })
})
