import { readFileSync } from "node:fs"
import path from "node:path"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import postcss, { type Root } from "postcss"
import tailwindcss from "tailwindcss"
import loadConfig from "tailwindcss/loadConfig"
import { beforeAll, describe, expect, it, vi } from "vitest"

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof React>()
  return { ...actual, useState: vi.fn(actual.useState) }
})
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }))
vi.mock("@/hooks/use-fond-plan", () => ({ useFondPlan: () => ({ fond: null, loading: false }) }))
vi.mock("@/components/garden/garden3d", () => ({ Garden3DView: () => null }))
vi.mock("@/components/meteo/PluviometriePlanche", () => ({ PluviometriePlanche: () => null }))

import Jardin3DPage from "./page"

let css: Root
beforeAll(async () => {
  const config = loadConfig(path.resolve("tailwind.config.ts"))
  const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8")
  const result = await postcss([
    tailwindcss({ ...config, content: [{ raw: source, extension: "tsx" }] }),
  ]).process("@tailwind utilities;", { from: undefined })
  css = result.root
})

function declaration(classe: string, propriete: string) {
  const selector = `.${classe.replace(/[:/]/g, "\\$&")}`
  let valeur: string | undefined
  let media: string | undefined
  css.walkRules((rule) => {
    if (rule.selector !== selector) return
    rule.walkDecls(propriete, (decl) => { valeur = decl.value })
    if (rule.parent?.type === "atrule" && rule.parent.name === "media") {
      media = rule.parent.params
    }
  })
  return { valeur, media }
}

function rendreBarre() {
  // Seul le chargement initial est remplacé : la vraie page rend sa barre
  // avec un objet fictif, sans monter WebGL ni appeler le réseau.
  vi.mocked(React.useState).mockReturnValueOnce([
    { planches: [], objets: [{ id: "objet-fictif", type: "serre" }], arbres: [], geometryParcelle: null },
    vi.fn(),
  ])
  const html = renderToStaticMarkup(React.createElement(Jardin3DPage))
  expect(html).toContain("+1 an")
  const barre = html.match(/<div class="([^"]*pointer-events-none[^"]*)"><div class="([^"]*max-w-xl[^"]*)">/)
  expect(barre).not.toBeNull()
  return { conteneur: barre![1].split(" "), panneau: barre![2].split(" ") }
}

describe("barre de temps de la vue 3D", () => {
  it("rend un fond blanc à 95 % dont la règle est réellement compilée", () => {
    const { panneau } = rendreBarre()
    const fond = panneau.find((classe) => classe.startsWith("bg-white/"))
    expect(fond).toBeDefined()
    expect(declaration(fond!, "background-color").valeur).toBe("rgb(255 255 255 / 0.95)")
  })

  it("réserve à droite 5 rem pour la bulle sur mobile et retrouve sa marge dès 640 px", () => {
    const { conteneur } = rendreBarre()
    expect(conteneur).toContain("pr-20")
    expect(conteneur).toContain("sm:pr-3")
    expect(declaration("pr-20", "padding-right")).toEqual({ valeur: "5rem", media: undefined })
    expect(declaration("sm:pr-3", "padding-right")).toEqual({ valeur: "0.75rem", media: "(min-width: 640px)" })
  })
})
