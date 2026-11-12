/**
 * Contexte réglementaire d'une ligne du registre (arrêté du 24 décembre 2025,
 * annexe I : culture, localisation, caractère biologique ; annexe II : GPS en
 * degrés décimaux WGS84).
 */
import { describe, expect, it } from "vitest"
import { composerContexteRegistre, coordonneesGps, estConduiteBio } from "../contexte-registre"

const jour = new Date("2026-05-04T08:00:00Z")

describe("composerContexteRegistre", () => {
  it("culture sur planche d'une parcelle : espèce et variété, planche, parcelle, commune et GPS", () => {
    const c = composerContexteRegistre(
      {
        culture: {
          espece: "Tomate",
          variete: "Cœur de bœuf",
          planche: {
            nom: "P3",
            ilot: "Nord",
            statutBio: "C2",
            parcelleGeo: { nom: "Le Pré", commune: "Lescar", centroidLat: 43.33, centroidLng: -0.43, statutBio: "Conventionnel" },
          },
        },
      },
      jour,
    )
    expect(c).toEqual({
      cultureRegistre: "Tomate (Cœur de bœuf)",
      localisationRegistre: "Planche P3 (îlot Nord) · Parcelle Le Pré · Lescar · GPS 43.3300000, -0.4300000 (WGS84)",
      // La planche porte la conduite : en conversion, donc biologique.
      conduiteBio: true,
    })
  })

  it("arbre géolocalisé : ses coordonnées priment sur le centre de la parcelle", () => {
    const c = composerContexteRegistre(
      {
        arbre: {
          nom: "Pommier du fond",
          espece: "Pommier",
          variete: "Reinette",
          gpsLat: 43.1,
          gpsLng: -0.2,
          parcelleGeo: { nom: "Verger", centroidLat: 43.0, centroidLng: -0.1 },
          zone: { nom: "Zone A", statutBio: "AB" },
        },
      },
      jour,
    )
    expect(c.cultureRegistre).toBe("Pommier Reinette — Pommier du fond")
    expect(c.localisationRegistre).toBe("Arbre Pommier du fond · Parcelle Verger · GPS 43.1000000, -0.2000000 (WGS84)")
    expect(c.conduiteBio).toBe(true)
  })

  it("rien de connu : tout à null, sans invention", () => {
    expect(composerContexteRegistre({}, jour)).toEqual({
      cultureRegistre: null,
      localisationRegistre: null,
      conduiteBio: null,
    })
  })
})

describe("estConduiteBio", () => {
  it("conventionnel : non ; conversion ou AB : oui ; statut inconnu : null", () => {
    expect(estConduiteBio({ nom: "P", statutBio: "Conventionnel" }, jour)).toBe(false)
    expect(estConduiteBio({ nom: "P", statutBio: "C1" }, jour)).toBe(true)
    expect(estConduiteBio({ nom: "P", statutBio: "AB" }, jour)).toBe(true)
    expect(estConduiteBio({ nom: "P", statutBio: null }, jour)).toBeNull()
    expect(estConduiteBio(null, jour)).toBeNull()
  })
})

describe("coordonneesGps", () => {
  it("sept décimales, WGS84 ; null si une coordonnée manque", () => {
    expect(coordonneesGps(43.2951234, -0.370789)).toBe("GPS 43.2951234, -0.3707890 (WGS84)")
    expect(coordonneesGps(null, 1)).toBeNull()
  })
})
