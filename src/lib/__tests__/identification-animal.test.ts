import { describe, it, expect } from "vitest"
import { isValidIdentifiant, placeholderIdentifiant, TYPES_IDENTIFIANT } from "../identification-animal"

describe("identification-animal", () => {
  it("BDNI bovin : FR + 10 chiffres", () => {
    expect(isValidIdentifiant("FR2412345678", "BDNI bovin")).toBe(true)
    expect(isValidIdentifiant("2412345678", "BDNI bovin")).toBe(true)
    expect(isValidIdentifiant("FR241234567", "BDNI bovin")).toBe(false)
    expect(isValidIdentifiant("FR24123456789", "BDNI bovin")).toBe(false)
  })

  it("IPG ovin/caprin : FR + 12 chiffres", () => {
    expect(isValidIdentifiant("FR012345601234", "IPG ovin")).toBe(true)
    expect(isValidIdentifiant("FR012345601234", "IPG caprin")).toBe(true)
    expect(isValidIdentifiant("0123456012345", "IPG ovin")).toBe(false)
  })

  it("IPG porcin : FR + 12 chiffres OU tatouage 5 chiffres", () => {
    expect(isValidIdentifiant("FR012345601234", "IPG porcin")).toBe(true)
    expect(isValidIdentifiant("12345", "IPG porcin")).toBe(true)
    expect(isValidIdentifiant("1234", "IPG porcin")).toBe(false)
  })

  it("SIRE équin : UELN 15 chiffres (250...) ou n° SIRE 8 chiffres", () => {
    expect(isValidIdentifiant("250000000000001", "SIRE équin")).toBe(true)
    expect(isValidIdentifiant("12345678", "SIRE équin")).toBe(true)
    expect(isValidIdentifiant("260000000000001", "SIRE équin")).toBe(false)
  })

  it("Puce RFID : ISO 11784 (15 chiffres)", () => {
    expect(isValidIdentifiant("250268500000001", "Puce RFID")).toBe(true)
    expect(isValidIdentifiant("25026850000000", "Puce RFID")).toBe(false)
  })

  it("Bague volière : alphanumérique court", () => {
    expect(isValidIdentifiant("AB-2026-001", "Bague volière")).toBe(true)
    expect(isValidIdentifiant("AB", "Bague volière")).toBe(false) // 2 chars < 3 min
  })

  it("Permissif si type non renseigné", () => {
    expect(isValidIdentifiant("n'importe quoi", null)).toBe(true)
    expect(isValidIdentifiant(null, "BDNI bovin")).toBe(true)
  })

  it("placeholderIdentifiant retourne un texte d'aide", () => {
    for (const t of TYPES_IDENTIFIANT) {
      const p = placeholderIdentifiant(t)
      expect(p.length).toBeGreaterThan(0)
    }
  })
})
