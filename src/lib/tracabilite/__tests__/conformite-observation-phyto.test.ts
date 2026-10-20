import { describe, expect, it } from "vitest"

/**
 * Revue du lot QA du 2026-10-20 (cmvgeltj1) — une seule liste de champs
 * réglementaires pour la saisie (POST/PUT /api/arbres/observations), la
 * conformité au registre général et les astérisques des dialogues Verger.
 */
import {
  champObligatoireObservation,
  champsManquantsObservationPhyto,
  estMethodeChimiqueObservation,
} from "../conformite-observation-phyto"

const chimiqueComplet = {
  methodeTraitement: "chimique_conventionnel",
  produit: "Produit test",
  numAMM: "9999999",
  doseAppliquee: 0.5,
  surfaceTraiteeHa: 0.01,
  dar: 7,
  volumeBouillieLHa: 500,
  temperatureC: 15,
  ventKmh: 5,
  hygrometriePct: 70,
  pluie24h: false,
  certiphytoNum: "TEST-1",
  zntRespectee: true,
}

describe("champsManquantsObservationPhyto", () => {
  it("traitement chimique complet : rien ne manque", () => {
    expect(champsManquantsObservationPhyto(chimiqueComplet)).toEqual([])
  })

  it("valeurs du formulaire en chaînes : « 0 » de DAR est une saisie, une surface nulle ne l'est pas", () => {
    const manquants = champsManquantsObservationPhyto({ ...chimiqueComplet, dar: "0", surfaceTraiteeHa: "0", doseAppliquee: "" })
    expect(manquants.map((c) => c.cle)).toEqual(["doseAppliquee", "surfaceTraitee"])
  })

  it("pluie « Non » (false) et ZNT non respectée (false) sont des réponses", () => {
    expect(champsManquantsObservationPhyto({ ...chimiqueComplet, pluie24h: false, zntRespectee: false })).toEqual([])
    expect(champsManquantsObservationPhyto({ ...chimiqueComplet, pluie24h: null }).map((c) => c.libelle)).toEqual(["Pluie ±24h"])
  })

  it("biocontrôle, purin, mécanique : aucune exigence", () => {
    for (const methode of ["biocontrole", "biologique_purin", "mecanique_manuel", null]) {
      expect(champsManquantsObservationPhyto({ methodeTraitement: methode })).toEqual([])
    }
  })

  it("la valeur historique « chimique » reste soumise aux champs réglementaires", () => {
    expect(estMethodeChimiqueObservation("chimique")).toBe(true)
    expect(champsManquantsObservationPhyto({ methodeTraitement: "chimique" }).length).toBeGreaterThan(0)
  })

  it("astérisques des dialogues : surface et DAR obligatoires en chimique seulement", () => {
    expect(champObligatoireObservation("chimique_cuivre", "surfaceTraitee")).toBe(true)
    expect(champObligatoireObservation("chimique_cuivre", "dar")).toBe(true)
    expect(champObligatoireObservation("biocontrole", "surfaceTraitee")).toBe(false)
    expect(champObligatoireObservation("chimique_cuivre", "inconnu")).toBe(false)
  })
})
