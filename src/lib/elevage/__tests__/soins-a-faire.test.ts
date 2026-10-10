/**
 * Ticket cmv294whk (QA 2026-10-10) — un animal mort restait à vacciner.
 */
import { describe, it, expect } from "vitest"
import { sqlSoinAnimalPresent, whereSoinAnimalPresent } from "../soins-a-faire"

describe("soins à faire d'un animal encore présent", () => {
  it("garde les soins de lot et ceux d'un animal actif", () => {
    expect(whereSoinAnimalPresent()).toEqual({
      OR: [{ animalId: null }, { animal: { statut: "actif" } }],
    })
  })

  it("rend un filtre neuf à chaque appel (pas d'objet partagé muté)", () => {
    expect(whereSoinAnimalPresent()).not.toBe(whereSoinAnimalPresent())
  })

  it("SQL brut : même règle, statut passé en paramètre", () => {
    expect(sqlSoinAnimalPresent.sql).toBe("(s.animal_id IS NULL OR a.statut = ?)")
    expect(sqlSoinAnimalPresent.values).toEqual(["actif"])
  })
})
