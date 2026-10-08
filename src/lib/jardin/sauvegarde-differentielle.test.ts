import { describe, expect, it } from "vitest"

import {
  confirmerEtatSauve,
  entitesModifiees,
  indexerEtatSauve,
} from "./sauvegarde-differentielle"

interface ArbrePlan {
  id: number
  posX: number
  posY: number
  libelleCalcule?: string
}

const empreinte = (arbre: ArbrePlan) => JSON.stringify([arbre.posX, arbre.posY])

describe("sauvegarde différentielle du plan", () => {
  it("n'envoie qu'un arbre déplacé dans un verger de 122 arbres", () => {
    const origine = Array.from({ length: 122 }, (_, index) => ({
      id: index + 1,
      posX: index,
      posY: 0,
    }))
    const etatSauve = indexerEtatSauve(origine, empreinte)
    const courant = origine.map((arbre) =>
      arbre.id === 74 ? { ...arbre, posX: arbre.posX + 1 } : arbre
    )

    expect(entitesModifiees(courant, etatSauve, empreinte).map(({ id }) => id)).toEqual([74])
  })

  it("ignore les champs d'affichage absents de l'empreinte", () => {
    const origine = [{ id: 1, posX: 2, posY: 3, libelleCalcule: "Pommier" }]
    const etatSauve = indexerEtatSauve(origine, empreinte)

    expect(
      entitesModifiees(
        [{ ...origine[0], libelleCalcule: "Pommier adulte" }],
        etatSauve,
        empreinte
      )
    ).toEqual([])
  })

  it("conserve une modification arrivée pendant la requête", () => {
    const origine = [{ id: 1, posX: 0, posY: 0 }]
    const etatSauve = indexerEtatSauve(origine, empreinte)
    const envoye = [{ id: 1, posX: 1, posY: 0 }]
    const courant = [{ id: 1, posX: 2, posY: 0 }]

    confirmerEtatSauve(etatSauve, envoye, empreinte)

    expect(entitesModifiees(courant, etatSauve, empreinte)).toEqual(courant)
  })
})
