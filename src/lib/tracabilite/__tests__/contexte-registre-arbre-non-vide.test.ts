/**
 * Garantie qui dispense `ObservationSante` et `OperationArbre` du marqueur
 * `contexte_fige` (voir le commentaire de `contexte-registre.ts`) : un contexte
 * composé à partir d'un arbre n'est jamais entièrement vide, même pour un
 * arbre au nom vide, sans espèce, sans parcelle ni zone.
 */
import { describe, expect, it } from "vitest"
import { composerContexteRegistre } from "../contexte-registre"

const jour = new Date(2026, 4, 4, 10, 0, 0)

const arbreNu = { nom: "", espece: null, variete: null, gpsLat: null, gpsLng: null, parcelleGeo: null, zone: null }

describe("contexte du registre composé depuis un arbre", () => {
  it("arbre réduit au minimum : dénomination et localisation non nulles", () => {
    const c = composerContexteRegistre({ arbre: arbreNu }, jour)
    expect(c.cultureRegistre).not.toBeNull()
    expect(c.localisationRegistre).not.toBeNull()
  })

  it("arbre avec parcelle observée (observation de santé) : dénomination et localisation non nulles", () => {
    const c = composerContexteRegistre(
      {
        arbre: { ...arbreNu, nom: "Pommier 3", espece: "Pommier" },
        parcelle: { nom: "Verger haut", commune: null, centroidLat: null, centroidLng: null },
      },
      jour,
    )
    expect(c.cultureRegistre).toBe("Pommier — Pommier 3")
    expect(c.localisationRegistre).toBe("Arbre Pommier 3 · Parcelle Verger haut")
  })

  it("espèce égale au nom : la dénomination reste le nom de l'arbre", () => {
    const c = composerContexteRegistre({ arbre: { ...arbreNu, nom: "Noyer", espece: "Noyer" } }, jour)
    expect(c.cultureRegistre).toBe("Noyer")
  })
})
