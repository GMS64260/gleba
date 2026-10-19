import { describe, expect, it } from "vitest"

import { ANCRE_CHEZ_MOI, estOngletFicheEspece, lienChezMoiEspece } from "../fiche-url"

describe("adresse de la carte « Chez moi » d'une espèce (ticket QA du 2026-10-19)", () => {
  it("ouvre l'onglet Récolte sur l'ancre de la carte, espèce adressée par son id encodé", () => {
    expect(lienChezMoiEspece("Basilic")).toBe(`/maraichage/especes/Basilic?tab=recolte#${ANCRE_CHEZ_MOI}`)
    expect(lienChezMoiEspece("Pomme de terre")).toBe("/maraichage/especes/Pomme%20de%20terre?tab=recolte#chez-moi")
  })

  it("seuls les onglets de la fiche sont reconnus dans l'URL", () => {
    expect(estOngletFicheEspece("recolte")).toBe(true)
    expect(estOngletFicheEspece("general")).toBe(true)
    expect(estOngletFicheEspece("inconnu")).toBe(false)
    expect(estOngletFicheEspece(null)).toBe(false)
  })
})
