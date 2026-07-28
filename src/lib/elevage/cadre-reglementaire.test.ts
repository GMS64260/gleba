import { describe, expect, it } from "vitest"
import {
  intervenantElevageInputSchema,
  manquesCadreReglementaire,
  normaliserListeSaisie,
} from "./cadre-reglementaire"

describe("cadre réglementaire de l’élevage", () => {
  it("normalise les listes saisies sans doublons", () => {
    expect(normaliserListeSaisie("Caprins, Ovins; caprins\nBovins")).toEqual([
      "Caprins",
      "Ovins",
      "Bovins",
    ])
  })

  it("exige une identité pour une relation active mais pas pour une absence documentée", () => {
    expect(intervenantElevageInputSchema.safeParse({
      role: "GDS_OVS",
      statut: "ACTIF",
      nom: "",
      organisme: "",
      especes: [],
      typesProduction: [],
    }).success).toBe(false)

    expect(intervenantElevageInputSchema.safeParse({
      role: "GDS_OVS",
      statut: "NON_CONCERNE",
      nom: "",
      organisme: "",
      especes: [],
      typesProduction: [],
    }).success).toBe(true)
  })

  it("n’autorise pas à éluder une responsabilité obligatoire", () => {
    expect(intervenantElevageInputSchema.safeParse({
      role: "DETENTEUR",
      statut: "NON_CONCERNE",
      nom: "",
      organisme: "",
      especes: [],
      typesProduction: [],
    }).success).toBe(false)
  })

  it("rejette une délégation dont la fin précède le début", () => {
    const resultat = intervenantElevageInputSchema.safeParse({
      role: "RESPONSABLE_REGISTRE",
      statut: "ACTIF",
      nom: "Alice Martin",
      especes: [],
      typesProduction: [],
      dateDebut: "2026-07-20",
      dateFin: "2026-07-01",
    })
    expect(resultat.success).toBe(false)
  })

  it("considère les rubriques conditionnelles explicitement non concernées comme documentées", () => {
    const roles = [
      "DETENTEUR",
      "PROPRIETAIRE_ANIMAUX",
      "RESPONSABLE_REGISTRE",
      "VETERINAIRE_SUIVI",
      "VETERINAIRE_SANITAIRE",
      "GDS_OVS",
      "ORGANISATION_PRODUCTION",
      "PROGRAMME_SANITAIRE",
    ]
    expect(manquesCadreReglementaire({
      lieux: [{ archivedAt: null }],
      intervenants: roles.map((role) => ({
        role,
        statut: ["GDS_OVS", "ORGANISATION_PRODUCTION", "PROGRAMME_SANITAIRE"].includes(role)
          ? "NON_CONCERNE"
          : "ACTIF",
        archivedAt: null,
      })),
    })).toEqual([])
  })

  it("ignore les lignes archivées dans le contrôle de complétude", () => {
    const manques = manquesCadreReglementaire({
      lieux: [{ archivedAt: "2026-07-26T00:00:00.000Z" }],
      intervenants: [{
        role: "DETENTEUR",
        statut: "ACTIF",
        archivedAt: "2026-07-26T00:00:00.000Z",
      }],
      veterinaireSanitaireLegacy: "Cabinet vétérinaire",
    })
    expect(manques).toContain("Lieux et constructions de détention non structurés")
    expect(manques).toContain("Détenteur des animaux non renseigné")
    expect(manques).not.toContain("Vétérinaire sanitaire non renseigné")
  })
})
