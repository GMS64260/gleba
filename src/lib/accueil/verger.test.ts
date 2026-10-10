import { describe, expect, it } from "vitest"

import { regrouperLotsVerger, type OperationArbreAccueil } from "./verger"

const maintenant = new Date(2026, 9, 10, 10, 0)
const op = (p: Partial<OperationArbreAccueil> & { id: number }): OperationArbreAccueil => ({
  type: "taille",
  description: "Taille en vert — Pincement des pousses",
  datePrevue: new Date(2026, 9, 5),
  fenetreDebut: new Date(2026, 8, 1),
  dateLimite: new Date(2026, 9, 31),
  abandonneeLe: null,
  fait: false,
  arbre: { id: p.id, nom: `Pommier ${p.id}` },
  ...p,
})

describe("regrouperLotsVerger", () => {
  it("regroupe par geste, compte les arbres et garde trois noms", () => {
    const { lots, counts } = regrouperLotsVerger([op({ id: 1 }), op({ id: 2 }), op({ id: 3 }), op({ id: 4 })], maintenant)
    expect(lots).toHaveLength(1)
    expect(lots[0]).toMatchObject({ libelle: "Taille en vert", type: "taille", nbArbres: 4, fenetre: "septembre-octobre", enRetard: false })
    expect(lots[0].arbres).toEqual(["Pommier 1", "Pommier 2", "Pommier 3"])
    expect(counts).toEqual({ aFaire: 4, aVenir: 0 })
  })

  it("écarte ce qui est fait, soldé, hors saison ou à venir, et met les retards fermes en tête", () => {
    const { lots, counts } = regrouperLotsVerger(
      [
        op({ id: 1, fait: true }),
        op({ id: 2, abandonneeLe: new Date(2026, 8, 30) }),
        op({ id: 3, dateLimite: new Date(2026, 8, 30) }),
        op({ id: 4, datePrevue: new Date(2026, 10, 2), fenetreDebut: null, dateLimite: null, description: "Plantation" }),
        op({ id: 5, type: "traitement", description: "Bouillie bordelaise", datePrevue: new Date(2026, 9, 1), fenetreDebut: null, dateLimite: null }),
        op({ id: 6 }),
      ],
      maintenant,
    )
    expect(lots.map((l) => l.libelle)).toEqual(["Bouillie bordelaise", "Taille en vert"])
    expect(lots[0].enRetard).toBe(true)
    expect(lots[0].echeance).toBe(new Date(2026, 9, 1).toISOString())
    expect(counts).toEqual({ aFaire: 2, aVenir: 1 })
  })
})
