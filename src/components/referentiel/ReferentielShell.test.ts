import { beforeEach, describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { renderToString } from "react-dom/server"

const mocks = vi.hoisted(() => ({ getSession: vi.fn() }))
vi.mock("@/lib/auth-utils", () => ({ getSession: mocks.getSession }))
vi.mock("@/components/shell/AppHeader", () => ({
  AppHeader: () => createElement("header", { "data-navigation-carnet": true },
    createElement("nav", { "aria-label": "Navigation du carnet" },
      createElement("a", { href: "/maraichage" }, "Mes cultures"),
      createElement("a", { href: "/parametres" }, "Mon compte"),
    ),
  ),
}))

import { ReferentielShell } from "./ReferentielShell"

async function rendre() {
  const shell = await ReferentielShell({ children: createElement("h1", null, "Absinthe : contenu public de la fiche") })
  return renderToString(shell)
}

describe("navigation du référentiel selon la session", () => {
  beforeEach(() => mocks.getSession.mockReset())

  it("conserve la navigation marketing et le contenu serveur pour un visiteur", async () => {
    mocks.getSession.mockResolvedValue(null)
    const html = await rendre()
    expect(html).toContain("Absinthe : contenu public de la fiche")
    expect(html).toContain("Se connecter")
    expect(html).toContain("Créer mon carnet")
    expect(html).toContain('href="/logiciel-maraichage"')
    expect(html).toContain("<footer")
    expect(html).not.toContain("data-navigation-carnet")
  })

  it.each([
    { cas: "un membre", email: "membre@example.invalid" },
    { cas: "le compte de démonstration connecté", email: "demo@gleba.fr" },
  ])("affiche le menu du carnet pour $cas, sans menu commercial", async ({ email }) => {
    mocks.getSession.mockResolvedValue({ user: { id: "acteur-du-banc", email }, expires: "2099-01-01T00:00:00.000Z" })
    const html = await rendre()
    expect(html).toContain("Absinthe : contenu public de la fiche")
    expect(html).toContain('aria-label="Navigation du carnet"')
    expect(html).toContain('href="/maraichage"')
    expect(html).toContain('id="contenu"')
    expect(html).not.toContain("Se connecter")
    expect(html).not.toContain("Créer mon carnet")
    expect(html).not.toContain('href="/logiciel-maraichage"')
    expect(html).not.toContain("<footer")
    expect(html).not.toContain("<aside")
    expect(html).not.toContain("acteur-du-banc")
    expect(html).not.toContain(email)
  })
})
