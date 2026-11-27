import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { GLOSSAIRE } from "./glossaire"

// Équipe debug, D249 : le Centre d'aide annonçait des sigles absents du glossaire.
describe("glossaire", () => {
  it("définit chaque sigle annoncé par le lien du Centre d'aide", () => {
    const aide = readFileSync("src/app/aide/page.tsx", "utf8")
    const annonce = /Termes agricoles, ([^<.]+)\.\.\./.exec(aide)?.[1] ?? ""
    const sigles = annonce.split(",").map((s) => s.trim()).filter((s) => /^[A-Z]{2,}$/.test(s))
    expect(sigles.length).toBeGreaterThan(0)
    for (const sigle of sigles) {
      expect((GLOSSAIRE as Record<string, { definition: string } | undefined>)[sigle]?.definition.length ?? 0, sigle).toBeGreaterThan(40)
    }
  })
})
