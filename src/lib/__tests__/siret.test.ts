import { describe, it, expect } from "vitest"
import {
  isValidSiren,
  isValidSiret,
  sirenFromSiret,
  tvaIntracomFromSiren,
  isValidTvaIntracomFr,
  formatSiret,
} from "../siret"

describe("siret", () => {
  it("valide un SIREN correct (Luhn)", () => {
    // 732829320 = SIREN INSEE de référence (Test, validé)
    expect(isValidSiren("732829320")).toBe(true)
  })

  it("rejette un SIREN avec mauvaise clé de Luhn", () => {
    expect(isValidSiren("732829321")).toBe(false)
  })

  it("rejette un SIREN trop court", () => {
    expect(isValidSiren("73282932")).toBe(false)
  })

  it("valide un SIRET correct (14 chiffres + Luhn)", () => {
    // SIRET de référence
    expect(isValidSiret("73282932000074")).toBe(true)
  })

  it("rejette un SIRET trop long", () => {
    expect(isValidSiret("732829320000740")).toBe(false)
  })

  it("accepte les espaces dans la saisie", () => {
    expect(isValidSiret("732 829 320 00074")).toBe(true)
  })

  it("gère le cas particulier La Poste (somme des chiffres divisible par 5)", () => {
    // SIREN 356000000 = La Poste, règle dérogatoire :
    // chaque SIRET doit avoir la somme des chiffres divisible par 5.
    // 356000000 + 00010 → somme = 3+5+6+0+0+0+0+0+0+0+0+0+1+0 = 15 → 15%5=0 ✓
    expect(isValidSiret("35600000000010")).toBe(true)
    // 356000000 + 00012 → somme = 17 → 17%5=2 ✗
    expect(isValidSiret("35600000000012")).toBe(false)
  })

  it("extrait le SIREN d'un SIRET", () => {
    expect(sirenFromSiret("73282932000074")).toBe("732829320")
  })

  it("calcule la TVA intracommunautaire FR depuis un SIREN", () => {
    // Formule : FR + clé(2 chiffres) + SIREN
    // clé = (12 + 3 × (SIREN % 97)) % 97
    const siren = "732829320"
    const tva = tvaIntracomFromSiren(siren)
    expect(tva).toMatch(/^FR\d{2}732829320$/)
    expect(isValidTvaIntracomFr(tva)).toBe(true)
  })

  it("rejette une TVA invalide", () => {
    expect(isValidTvaIntracomFr("FR00732829320")).toBe(false)
  })

  it("formatte un SIRET en groupes 3-3-3-5", () => {
    expect(formatSiret("73282932000074")).toBe("732 829 320 00074")
  })
})
