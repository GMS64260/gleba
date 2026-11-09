import { readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import { SEGMENTS_RACINE, segmentRacineInconnu } from "./segments-racine"

/** Premiers segments routables de `src/app`, groupes `(x)` dépliés. */
function segmentsDe(dossier: string): string[] {
  return readdirSync(dossier, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("_"))
    .flatMap((e) => (/^\(.+\)$/.test(e.name) ? segmentsDe(join(dossier, e.name)) : [e.name]))
}

describe("segments racine connus du middleware", () => {
  it("couvre chaque dossier de src/app : une route oubliée serait un 404 pour un visiteur", () => {
    const manquants = segmentsDe(join(process.cwd(), "src/app")).filter((s) => !SEGMENTS_RACINE.has(s))
    expect(manquants).toEqual([])
  })

  it("couvre chaque dossier de public", () => {
    const manquants = readdirSync(join(process.cwd(), "public"), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .filter((s) => !SEGMENTS_RACINE.has(s))
    expect(manquants).toEqual([])
  })

  it("reconnaît les chemins existants et inconnus", () => {
    expect(segmentRacineInconnu("/")).toBe(false)
    expect(segmentRacineInconnu("/logiciel-maraichage")).toBe(false)
    expect(segmentRacineInconnu("/referentiel/vegetaux/Tomate")).toBe(false)
    expect(segmentRacineInconnu("//ailleurs.example/piege")).toBe(false)
    expect(segmentRacineInconnu("/page-qui-nexiste-pas")).toBe(true)
    expect(segmentRacineInconnu("/wp-login.php")).toBe(true)
  })
})
