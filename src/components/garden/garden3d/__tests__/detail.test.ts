import { describe, expect, it } from "vitest"

import { cultureSelectionnee } from "../detail"
import type { Culture3D, Planche3D } from "../types"

function culture(id: number, nom: string): Culture3D {
  return {
    id,
    nbRangs: null,
    espacement: null,
    croissance: 0.5,
    itp: null,
    espece: { nom, couleur: null, etalement: null, famille: null },
  }
}

function planche(cultures: Culture3D[]): Planche3D {
  return { id: "p1", nom: "Nord", largeur: 1, longueur: 4, posX: 0, posY: 0, rotation2D: 0, cultures }
}

describe("cultureSelectionnee", () => {
  it("conserve le choix explicite sur une planche multi-cultures", () => {
    expect(cultureSelectionnee(planche([culture(1, "Tomate"), culture(2, "Basilic")]), 2)?.espece.nom).toBe("Basilic")
  })

  it("revient à la première culture quand la sélection appartient à une autre planche", () => {
    expect(cultureSelectionnee(planche([culture(3, "Carotte")]), 2)?.espece.nom).toBe("Carotte")
  })

  it("gère une planche sans culture", () => {
    expect(cultureSelectionnee(planche([]), null)).toBeUndefined()
  })
})
