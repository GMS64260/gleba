import { describe, expect, it } from "vitest"
import { genererJeton, hacherJeton, lireJetonBearer } from "./jeton"

describe("jeton de connecteur", () => {
  it("génère un jeton glc_ de 192 bits, dont la base ne garde que l'empreinte et le début", () => {
    const { jeton, hash, prefixe } = genererJeton()
    expect(jeton).toMatch(/^glc_[0-9a-f]{48}$/)
    expect(hash).toBe(hacherJeton(jeton))
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hash).not.toContain(jeton.slice(4))
    expect(prefixe).toBe(jeton.slice(0, 12))
  })

  it("deux jetons ne se ressemblent pas", () => {
    expect(genererJeton().jeton).not.toBe(genererJeton().jeton)
  })

  it("lit le jeton de l'en-tête Bearer, quelle que soit la casse", () => {
    const { jeton } = genererJeton()
    expect(lireJetonBearer(`Bearer ${jeton}`)).toBe(jeton)
    expect(lireJetonBearer(`bearer ${jeton.toUpperCase().replace("GLC_", "glc_")}`)).toBe(jeton)
  })

  it("refuse toute autre forme d'authentification", () => {
    const { jeton } = genererJeton()
    expect(lireJetonBearer(null)).toBeNull()
    expect(lireJetonBearer(jeton)).toBeNull()
    expect(lireJetonBearer(`Basic ${jeton}`)).toBeNull()
    expect(lireJetonBearer(`Bearer ${jeton} autre`)).toBeNull()
    expect(lireJetonBearer("Bearer glb_" + "0".repeat(48))).toBeNull()
  })
})
