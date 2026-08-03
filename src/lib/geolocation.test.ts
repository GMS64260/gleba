import { describe, expect, it } from "vitest"
import {
  latitudeValide,
  longitudeValide,
  messageErreurCoordonnees,
  recupererCoordonneeDecalee,
} from "./geolocation"

describe("bornes des coordonnées", () => {
  it("accepte les positions réelles et refuse les valeurs hors limites", () => {
    expect(latitudeValide(44.265412)).toBe(true)
    expect(longitudeValide(-0.563888)).toBe(true)
    expect(longitudeValide(-563888)).toBe(false)
    expect(latitudeValide(Number.NaN)).toBe(false)
  })
})

describe("messageErreurCoordonnees", () => {
  it("ne dit rien d'un couple valide ou totalement vide", () => {
    expect(messageErreurCoordonnees(44.26, -0.56)).toBeNull()
    expect(messageErreurCoordonnees(null, null)).toBeNull()
  })

  it("nomme le champ et la valeur fautive", () => {
    // Le cas de production : l'utilisateur modifiait la hauteur de l'arbre et
    // recevait « coordonnées invalides » sans savoir quoi corriger.
    const message = messageErreurCoordonnees(44.265412, -563888)
    expect(message).toContain("longitude -563888")
    expect(message).toContain("-180")
    expect(message).toContain("séparateur décimal")
  })

  it("signale un couple incomplet", () => {
    expect(messageErreurCoordonnees(44.26, null)).toContain("incomplètes")
  })
})

describe("recupererCoordonneeDecalee", () => {
  it("restitue le point décimal perdu en s'appuyant sur la référence du compte", () => {
    expect(
      recupererCoordonneeDecalee({ valeur: -563888, reference: -0.5645, max: 180 })
    ).toBe(-0.563888)
  })

  it("ne se contente pas de la première valeur qui rentre dans les bornes", () => {
    // -563888 / 1e5 = -5.63888 est déjà valide mais situe le point dans
    // l'Atlantique : seule la corroboration par la référence donne -0.563888.
    const recuperee = recupererCoordonneeDecalee({
      valeur: -563888,
      reference: -0.5645,
      max: 180,
    })
    expect(recuperee).not.toBe(-5.63888)
  })

  it("refuse de deviner quand rien ne corrobore", () => {
    expect(
      recupererCoordonneeDecalee({ valeur: -563888, reference: 7.5, max: 180 })
    ).toBeNull()
  })

  it("laisse tranquille une valeur déjà dans les bornes", () => {
    expect(
      recupererCoordonneeDecalee({ valeur: -0.563888, reference: -0.5645, max: 180 })
    ).toBeNull()
  })

  it("restitue aussi une latitude", () => {
    expect(
      recupererCoordonneeDecalee({ valeur: 44265412, reference: 44.265, max: 90 })
    ).toBe(44.265412)
  })
})
