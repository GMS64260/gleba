import { describe, expect, it } from "vitest"
import {
  anomaliesDocumentCirculation,
  construireSnapshotDocumentCirculation,
  declarationCompatibleDocumentCirculation,
  PREPARATION_CIRCULATION_VIDE,
} from "./document-circulation"
import type { DeclarationReglementaire } from "./declarations-reglementaires"

const declaration: DeclarationReglementaire = {
  key: "animal:12:SORTIE",
  type: "SORTIE",
  categorie: "CAPRIN",
  organisme: "EDE / Ovinfos",
  dateEvenement: "2026-07-25T00:00:00.000Z",
  dateEcheance: "2026-08-01T23:59:59.999Z",
  joursRestants: 7,
  statut: "A_DECLARER",
  libelle: "Sortie de FR123",
  espece: "Chèvre",
  cible: "FR123",
  sourceUrl: "/elevage",
  numeroEde: "EDE64",
  identifiants: ["FR123"],
  quantite: 1,
  origine: null,
  destination: null,
  anomalies: [],
  transmisAt: null,
  canalTransmission: null,
  referenceTransmission: null,
  notes: null,
  modifieeApresTransmission: false,
  snapshot: {},
  snapshotHash: "hash-declaration",
}

describe("document de circulation préparatoire", () => {
  it("est réservé aux mouvements ovins et caprins", () => {
    expect(declarationCompatibleDocumentCirculation(declaration)).toBe(true)
    expect(declarationCompatibleDocumentCirculation({ ...declaration, categorie: "BOVIN" })).toBe(false)
    expect(declarationCompatibleDocumentCirculation({ ...declaration, type: "MORTALITE" })).toBe(false)
  })

  it("signale les champs transport et destination manquants", () => {
    expect(anomaliesDocumentCirculation(declaration, PREPARATION_CIRCULATION_VIDE)).toEqual([
      "Type d’exploitation EDE manquant",
      "Catégorie dérogataire/non dérogataire des animaux manquante",
      "EDE/SIREN ou agrément sanitaire de destination manquant",
      "Numéro du transporteur manquant",
      "Immatriculation du véhicule manquante",
    ])
  })

  it("devient complet lorsque le tiers et le transport sont renseignés", () => {
    const preparation = {
      ...PREPARATION_CIRCULATION_VIDE,
      typeExploitationEde: "Exploitation d’élevage",
      categorieAnimaux: "NON_DEROGATAIRES",
      tiersNumeroEde: "EDE33",
      numeroTransporteur: "TRANS-1",
      immatriculationVehicule: "AA-123-BB",
    }
    expect(anomaliesDocumentCirculation(declaration, preparation)).toEqual([])
    expect(construireSnapshotDocumentCirculation(declaration, preparation)).toMatchObject({
      declarationKey: declaration.key,
      declarationSnapshotHash: "hash-declaration",
      anomalies: [],
    })
  })

  it("accepte un indicatif de marquage saisi pour un mouvement collectif", () => {
    const mouvementCollectif = {
      ...declaration,
      key: "lot:12:SORTIE",
      identifiants: [],
    }
    const preparation = {
      ...PREPARATION_CIRCULATION_VIDE,
      typeExploitationEde: "Exploitation d’élevage",
      categorieAnimaux: "BOUCHERIE_DEROGATAIRES",
      indicatifsMarquage: "FR 64 123 456",
      tiersNumeroEde: "EDE33",
      numeroTransporteur: "TRANS-1",
      immatriculationVehicule: "AA-123-BB",
    }

    expect(anomaliesDocumentCirculation(mouvementCollectif, preparation)).toEqual([])
  })
})
