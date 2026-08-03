import { describe, expect, it } from "vitest"
import {
  distancePointParcelleMetres,
  doitInfererParcelle,
  trouverParcelleGpsProche,
} from "./parcelle-gps-utils"

/** Parcelle réelle « Verger du potager » (compte de production, 2026-08-03). */
const VERGER_DU_POTAGER = {
  id: "p1",
  geometry: JSON.stringify({
    type: "Polygon",
    coordinates: [
      [
        [-0.563971, 44.265031],
        [-0.56396, 44.265287],
        [-0.563921, 44.265425],
        [-0.563819, 44.265433],
        [-0.563816, 44.26529],
        [-0.563799, 44.265032],
        [-0.563971, 44.265031],
      ],
    ],
  }),
}

const BASE = {
  parcelleChoisie: null,
  parcelleExistante: null,
  coordonneesFournies: true,
  lat: 44.265184,
  lng: -0.563815,
  latExistante: null,
  lngExistante: null,
}

describe("doitInfererParcelle", () => {
  it("infère sur un relevé GPS d'un arbre sans parcelle", () => {
    expect(doitInfererParcelle(BASE)).toBe(true)
  })

  it("infère même quand le payload porte parcelleGeoId à null", () => {
    // Le défaut corrigé : la fiche arbre renvoie l'objet complet, donc le champ
    // est toujours présent. La garde d'origine rendait l'inférence morte.
    expect(doitInfererParcelle({ ...BASE, parcelleChoisie: null })).toBe(true)
  })

  it("respecte une parcelle choisie explicitement", () => {
    expect(doitInfererParcelle({ ...BASE, parcelleChoisie: "p9" })).toBe(false)
  })

  it("ne réaffecte jamais un arbre déjà rattaché", () => {
    expect(doitInfererParcelle({ ...BASE, parcelleExistante: "p9" })).toBe(false)
  })

  it("respecte un « aucune parcelle » délibéré : sans position nouvelle, pas d'inférence", () => {
    expect(
      doitInfererParcelle({
        ...BASE,
        latExistante: BASE.lat,
        lngExistante: BASE.lng,
      })
    ).toBe(false)
  })

  it("n'infère pas sans coordonnées dans la requête ni sans position", () => {
    expect(doitInfererParcelle({ ...BASE, coordonneesFournies: false })).toBe(false)
    expect(doitInfererParcelle({ ...BASE, lat: null, lng: null })).toBe(false)
  })
})

describe("trouverParcelleGpsProche", () => {
  it("rattache un point intérieur à distance nulle", () => {
    expect(
      distancePointParcelleMetres({
        lat: 44.265184,
        lng: -0.563815,
        geometryGeoJson: VERGER_DU_POTAGER.geometry,
      })
    ).toBe(0)
    expect(
      trouverParcelleGpsProche([VERGER_DU_POTAGER], 44.265184, -0.563815)?.id
    ).toBe("p1")
  })

  it("rattache un arbre en bordure, dans la tolérance de 25 m", () => {
    // « POTAG - Feijoas 06 » : 19 m de la parcelle, planté juste au-delà du bord.
    const parcelle = trouverParcelleGpsProche([VERGER_DU_POTAGER], 44.265602, -0.563787)
    expect(parcelle?.id).toBe("p1")
  })

  it("laisse hors parcelle un arbre trop éloigné", () => {
    expect(trouverParcelleGpsProche([VERGER_DU_POTAGER], 44.265903, -0.564533)).toBeNull()
  })

  it("ignore une géométrie illisible au lieu de rattacher au hasard", () => {
    expect(
      trouverParcelleGpsProche(
        [{ id: "cassee", geometry: "pas du geojson" }],
        44.265184,
        -0.563815
      )
    ).toBeNull()
  })
})
