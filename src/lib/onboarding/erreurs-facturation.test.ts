/**
 * FRONT-01 (recette du 2026-11-12) : la réponse 400 de PUT /api/exploitation
 * nomme le champ fautif (`details.fieldErrors`), mais l'écran ne l'affichait
 * pas. Corps reproduit à l'identique de la réponse capturée en production.
 */
import { describe, expect, it } from "vitest"
import { erreursDepuisReponse, premierChampEnErreur, resumeErreurs } from "./erreurs-facturation"

const reponseSiretVide = {
  error: "Données invalides",
  details: { formErrors: [], fieldErrors: { siret: ["SIRET invalide (14 chiffres, clé de Luhn)"] } },
}

describe("erreurs de l'identité de facturation", () => {
  it("le SIRET vide est nommé, avec son message, et reçoit le focus", () => {
    const erreurs = erreursDepuisReponse(reponseSiretVide)
    expect(erreurs).toEqual({ siret: "SIRET invalide (14 chiffres, clé de Luhn)" })
    expect(premierChampEnErreur(erreurs)).toBe("siret")
    expect(resumeErreurs(erreurs)).toBe("SIRET : SIRET invalide (14 chiffres, clé de Luhn)")
  })

  it("plusieurs champs : le focus va au premier dans l'ordre de l'écran", () => {
    const erreurs = erreursDepuisReponse({
      details: { fieldErrors: { ville: ["Ville requise"], siret: ["SIRET invalide"], codePostal: ["Code postal à 5 chiffres"] } },
    })
    expect(premierChampEnErreur(erreurs)).toBe("siret")
    expect(resumeErreurs(erreurs)).toContain("Code postal : Code postal à 5 chiffres")
  })

  it("réponse sans détail exploitable : aucune erreur inventée", () => {
    expect(erreursDepuisReponse(null)).toEqual({})
    expect(erreursDepuisReponse({ error: "Erreur" })).toEqual({})
    expect(resumeErreurs({})).toBeNull()
    expect(premierChampEnErreur({})).toBeNull()
  })
})
