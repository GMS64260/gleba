/**
 * QA 2026-10-19 — Verger > Santé > Pollinisation : deux variétés de prunier
 * dont la floraison était saisie (S14 à S16) ressortaient « groupe de
 * floraison inconnu ». Règle unique de compatibilité de floraison, partagée
 * par la dérivation serveur et la suggestion du dialogue d'association.
 */
import { describe, expect, it } from "vitest"

import {
  AIDE_COMPATIBILITE_FLORAISON,
  compatibiliteFloraison,
  floraisonArbre,
  groupeFloraisonEchelle,
  groupesFloraisonAdjacents,
  refusPollinisateurFloraison,
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

  it("chevauchement d'une seule semaine sur des floraisons longues : partielle (moins de la moitié)", () => {
    const r = compatibiliteFloraison({ periode: { debut: 10, duree: 4 }, groupe: null }, { periode: { debut: 13, duree: 4 }, groupe: null })
    expect(r.compatible).toBe(true)
    expect(r.niveau).toBe("partielle")
    expect(r.raison).toContain("sur 1 semaine")
  })

  it("chevauchement d'au moins la moitié de la floraison la plus courte : bonne", () => {
    const r = compatibiliteFloraison({ periode: s14a16, groupe: null }, { periode: { debut: 15, duree: 3 }, groupe: null })
    expect(r).toMatchObject({ compatible: true, niveau: "bonne" })
  })

  it("disjoint : aucune semaine commune, pas pollinisateur, même si les groupes sont identiques", () => {
    const r = compatibiliteFloraison({ periode: { debut: 10, duree: 2 }, groupe: "B" }, { periode: { debut: 16, duree: 2 }, groupe: "B" })
    expect(r.compatible).toBe(false)
    expect(r.niveau).toBe("incompatible")
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
    expect(ecartes.niveau).toBe("incompatible")
  })

  it("une floraison qui passe par janvier chevauche le début d'année", () => {
    expect(semainesCommunes({ debut: 51, duree: 4 }, { debut: 1, duree: 2 })).toBe(2)
    expect(compatibiliteFloraison({ periode: { debut: 51, duree: 4 }, groupe: null }, { periode: { debut: 1, duree: 2 }, groupe: null }).compatible).toBe(true)
  })
})

/**
 * QA cmvgee5s9 (2026-10-20) — prunier A en S14-S16 (avril), B en S23-S25
 * (juin) : « Partielle » était pré-remplie et le texte d'aide annonçait
 * « aucune semaine commune = partielle ».
 */
describe("compatibiliteFloraison — les trois cas du signalement cmvgee5s9", () => {
  const s23a25 = { debut: 23, duree: 3 }

  it("aucune semaine commune : incompatible, annoncé et motif de refus", () => {
    const r = compatibiliteFloraison({ periode: s23a25, groupe: null }, { periode: s14a16, groupe: null })
    expect(r).toMatchObject({ compatible: false, certitude: "verifiee", base: "periodes", niveau: "incompatible" })
    const refus = refusPollinisateurFloraison(r)
    expect(refus).toContain("Pollinisateur incompatible")
    expect(refus).toContain("sans semaine commune")
  })

  it("recouvrement partiel : ni excellente ni incompatible, pas de refus", () => {
    const peu = compatibiliteFloraison({ periode: { debut: 14, duree: 4 }, groupe: null }, { periode: { debut: 17, duree: 4 }, groupe: null })
    expect(peu).toMatchObject({ compatible: true, niveau: "partielle" })
    expect(refusPollinisateurFloraison(peu)).toBeNull()
    const moitie = compatibiliteFloraison({ periode: s14a16, groupe: null }, { periode: { debut: 15, duree: 3 }, groupe: null })
    expect(moitie.niveau).toBe("bonne")
  })

  it("recouvrement complet : excellente", () => {
    const r = compatibiliteFloraison({ periode: s14a16, groupe: null }, { periode: s14a16, groupe: null })
    expect(r.niveau).toBe("excellente")
    // La floraison courte entièrement couverte par une plus longue l'est aussi.
    expect(compatibiliteFloraison({ periode: { debut: 13, duree: 5 }, groupe: null }, { periode: s14a16, groupe: null }).niveau).toBe("excellente")
  })

  it("une présomption n'est jamais refusée", () => {
    expect(refusPollinisateurFloraison(compatibiliteFloraison({ periode: s14a16, groupe: null }, { periode: null, groupe: null }))).toBeNull()
  })

  it("le texte d'aide annonce la règle appliquée, y compris les cas présumés et le triploïde", () => {
    expect(AIDE_COMPATIBILITE_FLORAISON).toContain("aucune semaine commune = incompatible")
    expect(AIDE_COMPATIBILITE_FLORAISON).not.toContain("aucune semaine commune = partielle")
    expect(AIDE_COMPATIBILITE_FLORAISON).toContain("partielle présumée")
    expect(AIDE_COMPATIBILITE_FLORAISON).toContain("triploïde")
  })
})

/**
 * Revue du 2026-10-20 — `arbres.groupe_pollinisation` est un texte libre : la
 * base contient « précoce », « mi-saison », « 3 ». Deux groupes hors échelle
 * différents étaient déclarés « trop écartés », vérifié : l'association était
 * refusée (422) et une association existante démentie, sans rien de vérifié.
 */
describe("compatibiliteFloraison — groupes hors de l'échelle A-E", () => {
  it("« précoce » face à « mi-saison », sans période : présumée, pas de refus", () => {
    const compat = compatibiliteFloraison({ periode: null, groupe: "précoce" }, { periode: null, groupe: "mi-saison" })
    expect(compat).toMatchObject({ compatible: true, certitude: "presumee", base: "donnees_incompletes", niveau: "partielle" })
    expect(compat.raison).toContain("hors de l'échelle A-E")
    expect(refusPollinisateurFloraison(compat)).toBeNull()
  })

  it("« 3 » face à « B », sans période : présumée, pas de refus", () => {
    const compat = compatibiliteFloraison({ periode: null, groupe: "3" }, { periode: null, groupe: "B" })
    expect(compat.certitude).toBe("presumee")
    expect(refusPollinisateurFloraison(compat)).toBeNull()
  })

  it("deux groupes hors échelle identiques ne sont pas non plus un verdict", () => {
    expect(compatibiliteFloraison({ periode: null, groupe: "précoce" }, { periode: null, groupe: "Précoce" }).certitude).toBe("presumee")
  })

  it("les périodes connues tranchent toujours, quel que soit le groupe", () => {
    const compat = compatibiliteFloraison({ periode: s14a16, groupe: "précoce" }, { periode: { debut: 23, duree: 3 }, groupe: "3" })
    expect(compat).toMatchObject({ compatible: false, certitude: "verifiee", niveau: "incompatible" })
    expect(refusPollinisateurFloraison(compat)).not.toBeNull()
  })

  it("groupeFloraisonEchelle ramène à A-E, sinon null", () => {
    expect(groupeFloraisonEchelle(" b ")).toBe("B")
    expect(groupeFloraisonEchelle("E")).toBe("E")
    expect(groupeFloraisonEchelle("mi-saison")).toBeNull()
    expect(groupeFloraisonEchelle("3")).toBeNull()
    expect(groupeFloraisonEchelle(null)).toBeNull()
  })
})

describe("floraisonArbre", () => {
  it("lit la période de la variété et préfère le groupe de l'arbre", () => {
    expect(floraisonArbre({ groupePollinisation: "C" }, { semaineFloraison: 14, dureeFloraison: 3, groupePollinisation: "B" })).toEqual({
      periode: { debut: 14, duree: 3 },
      groupe: "C",
    })
    expect(floraisonArbre({ groupePollinisation: null }, { semaineFloraison: null, groupePollinisation: "B" })).toEqual({ periode: null, groupe: "B" })
    expect(floraisonArbre({ groupePollinisation: null }, null)).toEqual({ periode: null, groupe: null })
  })
})

describe("groupesFloraisonAdjacents", () => {
  it("compare sans casse et accepte les groupes adjacents", () => {
    expect(groupesFloraisonAdjacents("a", "B")).toBe(true)
    expect(groupesFloraisonAdjacents("C", "A")).toBe(false)
    expect(groupesFloraisonAdjacents("X", "x")).toBe(true)
  })
})
