/**
 * Contexte réglementaire d'une ligne du registre (arrêté du 24 décembre 2025,
 * annexe I : culture, localisation, caractère biologique ; annexe II : GPS en
 * degrés décimaux WGS84).
 */
import { describe, expect, it } from "vitest"
import {
  composerContexteRegistre,
  contexteEstFige,
  coordonneesGps,
  estConduiteBio,
  mentionALaCreation,
  mentionApresRelecture,
} from "../contexte-registre"

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

describe("contexteEstFige (contre-revue ADV89-1)", () => {
  it("un contexte marqué figé l'est même si ses trois mentions sont vides", () => {
    expect(contexteEstFige({ contexteFige: true, cultureRegistre: null, localisationRegistre: null, conduiteBio: null })).toBe(true)
  })
  it("sans marqueur, une ligne ancienne est figée dès qu'une mention est enregistrée", () => {
    expect(contexteEstFige({ contexteFige: false, cultureRegistre: null, localisationRegistre: null, conduiteBio: false })).toBe(true)
    expect(contexteEstFige({ cultureRegistre: "Blé" })).toBe(true)
    expect(contexteEstFige({ contexteFige: false, cultureRegistre: null, localisationRegistre: null, conduiteBio: null })).toBe(false)
    expect(contexteEstFige({})).toBe(false)
  })
})

describe("provenance des mentions (contre-revue ADV89-2)", () => {
  it("à la création, la saisie prime sur la déduction", () => {
    expect(mentionALaCreation("Seigle", "Orge")).toEqual({ valeur: "Seigle", origine: "saisie" })
    expect(mentionALaCreation(false, true)).toEqual({ valeur: false, origine: "saisie" })
    expect(mentionALaCreation(undefined, "Orge")).toEqual({ valeur: "Orge", origine: "deduite" })
    expect(mentionALaCreation(null, null)).toEqual({ valeur: null, origine: null })
  })
  it("une déduction ne survit pas à sa source, même si la fiche a changé depuis", () => {
    expect(mentionApresRelecture({ stockee: "Ancienne", origine: "deduite", relue: null, referencesChangees: true }))
      .toEqual({ valeur: null, origine: null })
    expect(mentionApresRelecture({ stockee: true, origine: "deduite", relue: false, referencesChangees: false }))
      .toEqual({ valeur: false, origine: "deduite" })
  })
  it("une saisie renseignée est gardée ; vidée, elle le reste tant que les références ne changent pas", () => {
    expect(mentionApresRelecture({ stockee: "Avoine", origine: "saisie", relue: "Orge", referencesChangees: true }))
      .toEqual({ valeur: "Avoine", origine: "saisie" })
    expect(mentionApresRelecture({ stockee: null, origine: "saisie", relue: "Orge", referencesChangees: false }))
      .toEqual({ valeur: null, origine: "saisie" })
    expect(mentionApresRelecture({ stockee: null, origine: "saisie", relue: "Orge", referencesChangees: true }))
      .toEqual({ valeur: "Orge", origine: "deduite" })
  })
  it("provenance inconnue (ligne antérieure) : traitée prudemment comme une déduction", () => {
    expect(mentionApresRelecture({ stockee: "Héritée", origine: null, relue: null, referencesChangees: true }))
      .toEqual({ valeur: null, origine: null })
  })
})
