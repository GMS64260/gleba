import { describe, expect, it } from "vitest"

import { partitionnerArbresPourSauvegarde } from "../plan-sauvegarde"

const arbres = [
  { id: 1, nom: "Pommier" },
  { id: 2, nom: "Poirier" },
  { id: 3, nom: "Cerisier" },
]

describe("partitionnerArbresPourSauvegarde", () => {
  it("écrit tous les arbres quand aucune confirmation n'est pendante", () => {
    const { aEcrire, differes } = partitionnerArbresPourSauvegarde(arbres, [])

    expect(aEcrire).toHaveLength(3)
    expect(differes).toEqual([])
  })

  it("diffère le seul arbre en attente et laisse passer les autres", () => {
    const { aEcrire, differes } = partitionnerArbresPourSauvegarde(arbres, [2])

    expect(aEcrire.map(a => a.id)).toEqual([1, 3])
    expect(differes.map(a => a.id)).toEqual([2])
  })

  it("ne bloque jamais la sauvegarde entière, même avec plusieurs attentes", () => {
    const { aEcrire, differes } = partitionnerArbresPourSauvegarde(arbres, [1, 3])

    // Le cœur du correctif : une confirmation abandonnée gelait tout le plan.
    expect(aEcrire.map(a => a.id)).toEqual([2])
    expect(differes.map(a => a.id)).toEqual([1, 3])
  })

  it("ignore les identifiants en attente qui ne sont pas à l'écran", () => {
    const { aEcrire, differes } = partitionnerArbresPourSauvegarde(arbres, [99])

    expect(aEcrire).toHaveLength(3)
    expect(differes).toEqual([])
  })

  it("ne renvoie aucun arbre à écrire quand tous sont en attente", () => {
    const { aEcrire, differes } = partitionnerArbresPourSauvegarde(arbres, [1, 2, 3])

    expect(aEcrire).toEqual([])
    expect(differes).toHaveLength(3)
  })

  it("ne modifie pas le tableau source", () => {
    const source = [...arbres]
    partitionnerArbresPourSauvegarde(source, [2])

    expect(source).toEqual(arbres)
  })
})
