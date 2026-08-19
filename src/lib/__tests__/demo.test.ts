import { describe, it, expect } from "vitest"
import { DEMO_EMAIL, estEmailDemo } from "@/lib/demo"

describe("estEmailDemo", () => {
  it("reconnaît l'adresse du compte démo", () => {
    expect(estEmailDemo(DEMO_EMAIL)).toBe(true)
  })

  it("tolère la casse et les espaces parasites", () => {
    expect(estEmailDemo("Demo@Gleba.fr")).toBe(true)
    expect(estEmailDemo("  demo@gleba.fr  ")).toBe(true)
  })

  it("refuse toute autre adresse", () => {
    // Adresse neutre volontairement : ce test portait l'adresse réelle d'un
    // utilisateur, ce qui n'a pas sa place dans un dépôt public.
    expect(estEmailDemo("maraicher@example.com")).toBe(false)
    expect(estEmailDemo("demo@gleba.fr.evil.com")).toBe(false)
    expect(estEmailDemo("")).toBe(false)
    expect(estEmailDemo(null)).toBe(false)
    expect(estEmailDemo(undefined)).toBe(false)
  })
})
