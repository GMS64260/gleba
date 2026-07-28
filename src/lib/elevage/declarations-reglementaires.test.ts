import { describe, expect, it } from "vitest"
import {
  calculerEcheanceDeclaration,
  calculerStatutDeclaration,
  csvCell,
  empreinteDeclaration,
  lotNeSurExploitation,
  normaliserCategorieReglementaire,
  typeDeclarationCouvert,
} from "./declarations-reglementaires"

describe("déclarations réglementaires d'élevage", () => {
  it("normalise les catégories couvertes sans dépendre des accents", () => {
    expect(normaliserCategorieReglementaire("Bovin")).toBe("BOVIN")
    expect(normaliserCategorieReglementaire("Ovin")).toBe("OVIN")
    expect(normaliserCategorieReglementaire("Caprin")).toBe("CAPRIN")
    expect(normaliserCategorieReglementaire("Équin")).toBeNull()
  })

  it("couvre tous les événements bovins mais seulement les mouvements ovins et caprins", () => {
    expect(typeDeclarationCouvert("BOVIN", "NAISSANCE")).toBe(true)
    expect(typeDeclarationCouvert("BOVIN", "MORTALITE")).toBe(true)
    expect(typeDeclarationCouvert("OVIN", "ENTREE")).toBe(true)
    expect(typeDeclarationCouvert("CAPRIN", "SORTIE")).toBe(true)
    expect(typeDeclarationCouvert("OVIN", "NAISSANCE")).toBe(false)
    expect(typeDeclarationCouvert("CAPRIN", "MORTALITE")).toBe(false)
  })

  it("fixe l'échéance à la fin du septième jour suivant l'événement", () => {
    const echeance = calculerEcheanceDeclaration(new Date("2026-07-01T08:30:00.000Z"))
    expect(echeance.toISOString()).toBe("2026-07-08T23:59:59.999Z")
  })

  it("signale le retard même lorsque des informations restent à compléter", () => {
    const dateEcheance = new Date("2026-07-08T23:59:59.999Z")
    const maintenant = new Date("2026-07-10T10:00:00.000Z")
    expect(calculerStatutDeclaration({
      anomalies: ["Identifiant manquant"],
      dateEcheance,
      maintenant,
    })).toBe("HORS_DELAI")
    expect(calculerStatutDeclaration({
      anomalies: [],
      dateEcheance,
      maintenant,
    })).toBe("HORS_DELAI")
  })

  it("conserve un statut finalisé et détecte des snapshots de façon stable", () => {
    const dateEcheance = new Date("2026-07-08T23:59:59.999Z")
    expect(calculerStatutDeclaration({
      anomalies: [],
      dateEcheance,
      maintenant: new Date("2026-07-20T10:00:00.000Z"),
      suivi: {
        statut: "TRANSMISE",
        transmisAt: new Date("2026-07-05T10:00:00.000Z"),
        canalTransmission: "Portail EDE",
        referenceTransmission: "AR-123",
        notes: null,
        snapshotHash: "hash",
      },
    })).toBe("TRANSMISE")

    expect(empreinteDeclaration({ b: 2, a: { y: 2, x: 1 } }))
      .toBe(empreinteDeclaration({ a: { x: 1, y: 2 }, b: 2 }))
  })

  it("échappe les cellules CSV sans perdre les guillemets", () => {
    expect(csvCell('Lot "A"; ligne 2')).toBe('"Lot ""A""; ligne 2"')
    expect(csvCell("=LIEN.HYPERTEXTE(\"https://example.test\")"))
      .toBe(`"'=LIEN.HYPERTEXTE(""https://example.test"")"`)
  })

  it("ne transforme pas un lot de petits nés sur place en entrée externe", () => {
    expect(lotNeSurExploitation({
      dateArrivee: new Date("2026-03-10T14:00:00.000Z"),
      provenance: null,
      datesNaissances: [new Date("2026-03-10T07:00:00.000Z")],
    })).toBe(true)
    expect(lotNeSurExploitation({
      dateArrivee: new Date("2026-03-10T14:00:00.000Z"),
      provenance: "EDE 330001",
      datesNaissances: [new Date("2026-03-10T07:00:00.000Z")],
    })).toBe(false)
    expect(lotNeSurExploitation({
      dateArrivee: new Date("2026-03-10T14:00:00.000Z"),
      provenance: null,
      datesNaissances: [new Date("2026-03-11T07:00:00.000Z")],
    })).toBe(false)
  })
})
