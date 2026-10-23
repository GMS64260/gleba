/**
 * QA cmvkp3kqc (2026-10-23) — porte-greffe du catalogue absent de l'inspecteur
 * du plan : la saisie libre ne doit pas perdre l'id du référentiel quand le
 * texte désigne toujours le même porte-greffe.
 */
import { describe, expect, it } from "vitest"

import { valeurDepuisSaisieLibre } from "../porte-greffe-saisie"

const ACTUEL = { porteGreffeId: "pg-stjulien", libelle: "Prunier Saint-Julien A" }

describe("valeurDepuisSaisieLibre", () => {
  it("garde l'id quand le texte désigne le même porte-greffe", () => {
    expect(valeurDepuisSaisieLibre(" prunier saint julien a ", ACTUEL)).toEqual({
      porteGreffeId: "pg-stjulien",
      portGreffe: "prunier saint julien a",
    })
  })

  it("passe en saisie libre sans id pour un autre texte", () => {
    expect(valeurDepuisSaisieLibre("M26", ACTUEL)).toEqual({ porteGreffeId: null, portGreffe: "M26" })
  })

  it("vide les deux colonnes quand le champ est effacé", () => {
    expect(valeurDepuisSaisieLibre("  ", ACTUEL)).toEqual({ porteGreffeId: null, portGreffe: null })
  })

  it("n'invente pas d'id pour un arbre en saisie libre", () => {
    expect(valeurDepuisSaisieLibre("M9", { porteGreffeId: null, libelle: "M9" })).toEqual({ porteGreffeId: null, portGreffe: "M9" })
  })
})
