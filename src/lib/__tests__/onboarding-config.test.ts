import { describe, expect, it } from "vitest"

import {
  CHEPTEL_ONBOARDING,
  coordonneesValides,
  etapeDepuisIndexLegacy,
  etapesPourModules,
  parcelleCarreeAutour,
} from "@/lib/onboarding-config"

/**
 * Refonte onboarding 2026-08-17 — la configuration minimale de l'exploitation
 * à la première connexion, pilotée par les modules activés.
 */

describe("etapesPourModules", () => {
  it("adapte les étapes aux modules : production si production, facturation si compta", () => {
    expect(etapesPourModules(["maraichage", "comptabilite"])).toEqual([
      "exploitation",
      "modules",
      "production",
      "facturation",
      "demarrage",
    ])
  })

  it("saute la facturation sans comptabilité", () => {
    expect(etapesPourModules(["elevage"])).toEqual([
      "exploitation",
      "modules",
      "production",
      "demarrage",
    ])
  })

  it("saute la production pour une compta pure", () => {
    expect(etapesPourModules(["comptabilite"])).toEqual([
      "exploitation",
      "modules",
      "facturation",
      "demarrage",
    ])
  })

  it("garde un parcours minimal viable sans aucun module", () => {
    expect(etapesPourModules([])).toEqual(["exploitation", "modules", "demarrage"])
  })
})

describe("etapeDepuisIndexLegacy", () => {
  it("rabat l'ancien index numérique sur l'étape la plus proche", () => {
    expect(etapeDepuisIndexLegacy(0)).toBe("exploitation")
    expect(etapeDepuisIndexLegacy(1)).toBe("modules")
    expect(etapeDepuisIndexLegacy(2)).toBe("production")
    expect(etapeDepuisIndexLegacy(3)).toBe("production") // ex-étape Import
    expect(etapeDepuisIndexLegacy(4)).toBe("demarrage")
  })
})

describe("parcelleCarreeAutour", () => {
  it("produit un anneau GeoJSON fermé centré sur le point", () => {
    const p = parcelleCarreeAutour(45.0, 1.0)
    const geo = JSON.parse(p.geometry)
    expect(geo.type).toBe("Polygon")
    const anneau = geo.coordinates[0]
    expect(anneau).toHaveLength(5)
    expect(anneau[0]).toEqual(anneau[4]) // fermé
    // Centre = moyenne des coins
    expect((anneau[0][1] + anneau[2][1]) / 2).toBeCloseTo(45.0, 6)
    expect((anneau[0][0] + anneau[2][0]) / 2).toBeCloseTo(1.0, 6)
    expect(p.centroidLat).toBe(45.0)
    expect(p.centroidLng).toBe(1.0)
  })

  it("corrige le pas de longitude du cosinus de la latitude", () => {
    const equateur = JSON.parse(parcelleCarreeAutour(0.01, 0).geometry).coordinates[0]
    const nord = JSON.parse(parcelleCarreeAutour(60, 0).geometry).coordinates[0]
    const largeurEquateur = equateur[1][0] - equateur[0][0]
    const largeurNord = nord[1][0] - nord[0][0]
    // À 60° de latitude, un mètre couvre ~2× plus de degrés de longitude.
    expect(largeurNord / largeurEquateur).toBeCloseTo(2, 1)
  })

  it("annonce la surface en hectares (50 m → 0,25 ha)", () => {
    expect(parcelleCarreeAutour(45, 1).surfaceHa).toBe(0.25)
  })
})

describe("coordonneesValides", () => {
  it("accepte la métropole et l'outre-mer", () => {
    expect(coordonneesValides(45.18, 1.32)).toBe(true) // Corrèze
    expect(coordonneesValides(-21.1, 55.5)).toBe(true) // La Réunion
    expect(coordonneesValides(16.24, -61.53)).toBe(true) // Guadeloupe
  })

  it("refuse l'artefact (0,0) et les valeurs hors bornes", () => {
    expect(coordonneesValides(0, 0)).toBe(false)
    expect(coordonneesValides(91, 0)).toBe(false)
    expect(coordonneesValides(45, 181)).toBe(false)
    expect(coordonneesValides(Number.NaN, 1)).toBe(false)
  })
})

describe("CHEPTEL_ONBOARDING", () => {
  it("ne référence que des espèces distinctes", () => {
    const ids = CHEPTEL_ONBOARDING.map((c) => c.especeAnimaleId)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
