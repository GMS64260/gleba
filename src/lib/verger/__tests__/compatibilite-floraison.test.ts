/**
 * QA 2026-10-19 — Verger > Santé > Pollinisation : deux variétés de prunier
 * dont la floraison était saisie (S14 à S16) ressortaient « groupe de
 * floraison inconnu ». Règle unique de compatibilité de floraison, partagée
 * par la dérivation serveur et la suggestion du dialogue d'association.
 */
import { describe, expect, it } from "vitest"

import {
  compatibiliteFloraison,
  groupesFloraisonAdjacents,
  semainesCommunes,
} from "../compatibilite-floraison"

const s14a16 = { debut: 14, duree: 3 }

describe("compatibiliteFloraison", () => {
  it("chevauchement : deux floraisons saisies avec des semaines communes sont une compatibilité vérifiée", () => {
    const r = compatibiliteFloraison({ periode: s14a16, groupe: null }, { periode: { debut: 15, duree: 3 }, groupe: null })
    expect(r.compatible).toBe(true)
    expect(r.certitude).toBe("verifiee")
    expect(r.base).toBe("periodes")
    expect(r.raison).toContain("floraisons simultanées")
  })

  it("scénario du signalement : S14 à S16 des deux côtés, sans groupe, est vérifié et excellent", () => {
    const r = compatibiliteFloraison({ periode: s14a16, groupe: null }, { periode: s14a16, groupe: null })
    expect(r).toMatchObject({ compatible: true, certitude: "verifiee", base: "periodes", niveau: "excellente" })
  })

  it("chevauchement d'une seule semaine sur des floraisons longues : bonne, pas excellente", () => {
    const r = compatibiliteFloraison({ periode: { debut: 10, duree: 4 }, groupe: null }, { periode: { debut: 13, duree: 4 }, groupe: null })
    expect(r.compatible).toBe(true)
    expect(r.niveau).toBe("bonne")
  })

  it("disjoint : aucune semaine commune, pas pollinisateur, même si les groupes sont identiques", () => {
    const r = compatibiliteFloraison({ periode: { debut: 10, duree: 2 }, groupe: "B" }, { periode: { debut: 16, duree: 2 }, groupe: "B" })
    expect(r.compatible).toBe(false)
    expect(r.certitude).toBe("verifiee")
    expect(r.base).toBe("periodes")
    expect(r.raison).toContain("sans semaine commune")
  })

  it("une seule variété renseignée, sans groupes : présumée, jamais affirmée", () => {
    const r = compatibiliteFloraison({ periode: s14a16, groupe: null }, { periode: null, groupe: null })
    expect(r.compatible).toBe(true)
    expect(r.certitude).toBe("presumee")
    expect(r.base).toBe("donnees_incompletes")
    expect(r.niveau).toBe("partielle")
    expect(r.raison).toContain("une seule des deux variétés")
  })

  it("une seule période mais deux groupes connus : les groupes tranchent", () => {
    const r = compatibiliteFloraison({ periode: s14a16, groupe: "A" }, { periode: null, groupe: "B" })
    expect(r).toMatchObject({ compatible: true, certitude: "verifiee", base: "groupes", niveau: "bonne" })
  })

  it("aucune donnée : présumée", () => {
    const r = compatibiliteFloraison({ periode: null, groupe: null }, { periode: null, groupe: null })
    expect(r).toMatchObject({ compatible: true, certitude: "presumee", base: "donnees_incompletes" })
    expect(r.raison).toContain("ni période ni groupe")
  })

  it("repli sur les groupes : identiques = excellente, adjacents = bonne, écartés = pas pollinisateur", () => {
    expect(compatibiliteFloraison({ periode: null, groupe: "B" }, { periode: null, groupe: "b" }).niveau).toBe("excellente")
    expect(compatibiliteFloraison({ periode: null, groupe: "B" }, { periode: null, groupe: "C" }).niveau).toBe("bonne")
    const ecartes = compatibiliteFloraison({ periode: null, groupe: "A" }, { periode: null, groupe: "D" })
    expect(ecartes.compatible).toBe(false)
    expect(ecartes.base).toBe("groupes")
  })

  it("une floraison qui passe par janvier chevauche le début d'année", () => {
    expect(semainesCommunes({ debut: 51, duree: 4 }, { debut: 1, duree: 2 })).toBe(2)
    expect(compatibiliteFloraison({ periode: { debut: 51, duree: 4 }, groupe: null }, { periode: { debut: 1, duree: 2 }, groupe: null }).compatible).toBe(true)
  })
})

describe("groupesFloraisonAdjacents", () => {
  it("compare sans casse et accepte les groupes adjacents", () => {
    expect(groupesFloraisonAdjacents("a", "B")).toBe(true)
    expect(groupesFloraisonAdjacents("C", "A")).toBe(false)
    expect(groupesFloraisonAdjacents("X", "x")).toBe(true)
  })
})
