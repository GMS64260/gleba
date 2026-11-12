/**
 * FRONT-04 (recette du 2026-11-12) : l'étape « Saisir un soin » des premiers
 * pas de l'élevage ouvrait /elevage?tab=alimentation, c'est-à-dire les stocks
 * d'aliments, sans formulaire de soin.
 */
import { describe, expect, it } from "vitest"
import { CONFIGS } from "../premiers-pas-banner"

describe("liens des premiers pas", () => {
  it("« Saisir un soin » ouvre l'onglet Soins avec le formulaire", () => {
    const soin = CONFIGS.elevage.buildSteps({}).find((e) => e.key === "soin")
    const url = new URL(soin!.href, "https://exemple.invalid")
    expect(url.pathname).toBe("/elevage")
    expect(url.searchParams.get("tab")).toBe("alimentation")
    expect(url.searchParams.get("sub")).toBe("soins")
    expect(url.searchParams.get("action")).toBe("nouveau-soin")
  })

  it("« Enregistrer votre premier animal » ouvre l'onglet Animaux complet (FRONT-09)", () => {
    const animal = CONFIGS.elevage.buildSteps({}).find((e) => e.key === "animal")
    expect(animal!.href).toBe("/elevage?tab=animaux")
  })
})
