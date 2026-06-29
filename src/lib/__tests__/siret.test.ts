import { describe, it, expect } from "vitest"
import {
  isValidSiren,
  isValidSiret,
  sirenFromSiret,
  tvaIntracomFromSiren,
  isValidTvaIntracomFr,
  formatSiret,
  isValidRidet,
  formatRidet,
  isValidNumeroTahiti,
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

describe("identifiants outre-mer", () => {
  it("valide un RIDET (Nouvelle-Calédonie) avec ou sans point/suffixe", () => {
    expect(isValidRidet("0858878.004")).toBe(true)
    expect(isValidRidet("0858878004")).toBe(true)
    expect(isValidRidet("0858878")).toBe(true)
  })

  it("rejette un RIDET au format invalide", () => {
    expect(isValidRidet("12345")).toBe(false) // trop court
    expect(isValidRidet("12345678901")).toBe(false) // trop long
    expect(isValidRidet("ABC123")).toBe(false)
    expect(isValidRidet("")).toBe(false)
  })

  it("formatte un RIDET base.établissement", () => {
    expect(formatRidet("0858878004")).toBe("0858878.004")
    expect(formatRidet("0858878.004")).toBe("0858878.004")
    expect(formatRidet("0858878")).toBe("0858878")
  })

  it("valide un N° Tahiti (Polynésie française)", () => {
    expect(isValidNumeroTahiti("123456")).toBe(true)
    expect(isValidNumeroTahiti("123456A")).toBe(true)
  })

  it("rejette un N° Tahiti invalide", () => {
    expect(isValidNumeroTahiti("12345")).toBe(false)
    expect(isValidNumeroTahiti("1234567")).toBe(false)
    expect(isValidNumeroTahiti("")).toBe(false)
  })
})
