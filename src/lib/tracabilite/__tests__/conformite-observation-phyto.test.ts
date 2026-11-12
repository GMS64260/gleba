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

// Revue de conformité du 2026-11-12 (C1) : arrêté du 24 décembre 2025, annexe I.
describe("champsManquantsRegistreObservation", () => {
  it("biocontrôle sous AMM : produit, AMM, dose et surface exigés au registre", async () => {
    const { champsManquantsRegistreObservation } = await import("../conformite-observation-phyto")
    const cles = champsManquantsRegistreObservation({ methodeTraitement: "biocontrole" }).map((c) => c.cle)
    expect(cles).toEqual(["produitPhyto", "numAMM", "doseAppliquee", "surfaceTraitee"])
  })

  it("dose sans unité : signalée", async () => {
    const { champsManquantsRegistreObservation } = await import("../conformite-observation-phyto")
    const cles = champsManquantsRegistreObservation({
      methodeTraitement: "biocontrole", produit: "Bt", numAMM: "2000001", doseAppliquee: 1, surfaceTraiteeHa: 0.1,
    }).map((c) => c.cle)
    expect(cles).toEqual(["uniteDose"])
  })

  it("macro-organismes, purin, mécanique, prophylaxie : aucune mention produit exigée", async () => {
    const { champsManquantsRegistreObservation } = await import("../conformite-observation-phyto")
    for (const methode of ["macro_organismes", "biologique_purin", "mecanique_manuel", "prophylaxie"]) {
      expect(champsManquantsRegistreObservation({ methodeTraitement: methode })).toEqual([])
    }
  })

  it("la saisie d'un biocontrôle reste non bloquante (fait réel incomplet enregistrable)", async () => {
    const { champsManquantsObservationPhyto } = await import("../conformite-observation-phyto")
    expect(champsManquantsObservationPhyto({ methodeTraitement: "biocontrole" })).toEqual([])
  })
})

