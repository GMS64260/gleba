/**
 * QA cmvkoxe5o (2026-10-23) — une récolte de Mirabelle de Nancy (référentiel :
 * S33, deux semaines, « mi-août ») déplacée au 10 juillet ne levait aucune
 * alerte : l'encart lisait le calendrier de l'espèce (prunier : juillet-
 * septembre) et la modification ne contrôlait rien.
 */
import { describe, expect, it, vi } from "vitest"

import { alerteSaisonRecolteArbre, chargerPeriodesRecolteVarietes } from "../saison-recolte-arbre"

const MIRABELLE = { nom: "Mirabelle de Nancy", semaineRecolte: 33, dureeRecolte: 2 }

describe("alerteSaisonRecolteArbre", () => {
  it("alerte sur la période de la variété, même dans la fenêtre de l'espèce", () => {
    const alerte = alerteSaisonRecolteArbre({ espece: "Prunier", variete: MIRABELLE, date: "2026-07-10" })
    expect(alerte?.message).toContain("Mirabelle de Nancy")
    expect(alerte?.message).toContain("S33")
    expect(alerte?.message).toContain("10 juillet")
  })

  it("alerte après la période de la variété (15 septembre)", () => {
    expect(alerteSaisonRecolteArbre({ espece: "Prunier", variete: MIRABELLE, date: "2026-09-15" })).not.toBeNull()
  })

  it("se tait dans la période et dans la tolérance de trois semaines", () => {
    expect(alerteSaisonRecolteArbre({ espece: "Prunier", variete: MIRABELLE, date: "2026-08-14" })).toBeNull()
    // S30 (fin juillet) : trois semaines avant S33.
    expect(alerteSaisonRecolteArbre({ espece: "Prunier", variete: MIRABELLE, date: "2026-07-22" })).toBeNull()
  })

  it("lit une période à cheval sur janvier", () => {
    const hiver = { nom: "Kaki d'hiver", semaineRecolte: 50, dureeRecolte: 6 } // S50 → S03
    expect(alerteSaisonRecolteArbre({ espece: "Plaqueminier", variete: hiver, date: "2027-01-12" })).toBeNull()
    expect(alerteSaisonRecolteArbre({ espece: "Plaqueminier", variete: hiver, date: "2026-12-01" })).toBeNull()
    expect(alerteSaisonRecolteArbre({ espece: "Plaqueminier", variete: hiver, date: "2026-07-01" })).not.toBeNull()
  })

  it("retombe sur le calendrier de l'espèce quand la variété n'a pas de période", () => {
    const sansPeriode = { nom: "Inconnue", semaineRecolte: null, dureeRecolte: null }
    expect(alerteSaisonRecolteArbre({ espece: "Prunier", variete: sansPeriode, date: "2026-07-10" })).toBeNull()
    expect(alerteSaisonRecolteArbre({ espece: "Prunier", variete: null, date: "2026-01-15" })?.message).toContain("prunier")
  })

  it("ignore une date illisible ou absente", () => {
    expect(alerteSaisonRecolteArbre({ espece: "Prunier", variete: MIRABELLE, date: "" })).toBeNull()
    expect(alerteSaisonRecolteArbre({ espece: "Prunier", variete: MIRABELLE, date: "pas une date" })).toBeNull()
  })
})

describe("chargerPeriodesRecolteVarietes", () => {
  it("résout la variété par son libellé dans l'espèce, en une requête", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: "Mirabelle de Nancy", nom: "Mirabelle de Nancy", nomNormalise: "mirabelle de nancy", especeId: "Prunier", userId: null, semaineRecolte: 33, dureeRecolte: 2 },
    ])
    const a = { variete: "mirabelle de nancy", especeId: "Prunier", espece: "Prunier" }
    const b = { variete: null, especeId: "Prunier", espece: "Prunier" }
    const periodes = await chargerPeriodesRecolteVarietes({ variete: { findMany } } as never, "u1", [a, b])
    expect(findMany).toHaveBeenCalledTimes(1)
    expect(periodes.get(a)).toEqual(MIRABELLE)
    expect(periodes.get(b)).toBeNull()
  })

  it("ne lit rien quand aucun arbre n'a de variété", async () => {
    const findMany = vi.fn()
    const a = { variete: "  ", especeId: "Prunier", espece: "Prunier" }
    const periodes = await chargerPeriodesRecolteVarietes({ variete: { findMany } } as never, "u1", [a])
    expect(findMany).not.toHaveBeenCalled()
    expect(periodes.get(a)).toBeNull()
  })
})
