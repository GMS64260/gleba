import { describe, expect, it } from "vitest"
import { bornesPageCatalogue, filtreCatalogue, lireRechercheCatalogue, TAILLE_PAGE_CATALOGUE } from "./catalogue"
import { visibiliteReferentielPublic } from "@/lib/referentiel-public"

describe("catalogue de l’encyclopédie", () => {
  it("borne la recherche et refuse les types et pages arbitraires", () => {
    const recherche = lireRechercheCatalogue(new URLSearchParams({ q: ` ${"a".repeat(90)} `, type: "userId", page: "-1" }))
    expect(recherche).toEqual({ q: "a".repeat(80), type: "", page: 1, sansPhoto: false })
    expect(lireRechercheCatalogue(new URLSearchParams({ page: "1e5" })).page).toBe(1)
    expect(lireRechercheCatalogue(new URLSearchParams({ page: "9999999" })).page).toBe(1_000_000)
  })

  it("garde la barrière publique même avec recherche et filtre photo", () => {
    const where = filtreCatalogue(lireRechercheCatalogue(new URLSearchParams({ q: "tomate", type: "legume", sansPhoto: "1" })))
    expect(where.AND).toContainEqual(visibiliteReferentielPublic)
    expect(where.AND).toContainEqual({ type: "legume" })
    expect(where.AND).toContainEqual({ medias: { none: { statut: "VALIDE" } } })
    expect(JSON.stringify(where)).not.toContain("email")
  })

  it("récupère une page réelle même quand une URL vise au-delà de la fin", () => {
    expect(TAILLE_PAGE_CATALOGUE).toBe(24)
    expect(bornesPageCatalogue(25, 500)).toEqual({ page: 2, pages: 2, skip: 24 })
    expect(bornesPageCatalogue(0, 500)).toEqual({ page: 1, pages: 1, skip: 0 })
    expect(bornesPageCatalogue(48, 2)).toEqual({ page: 2, pages: 2, skip: 24 })
  })
})
