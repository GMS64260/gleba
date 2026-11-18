import { describe, expect, it } from "vitest"
import { devisePieceAffichage, formatMontantPiece, totalDansDeviseCourante } from "../devise-piece-affichage"

describe("devise des ventes affichées hors comptabilité", () => {
  it("utilise la devise courante pour une ligne sans devise figée", () => {
    expect(formatMontantPiece(1234.56, {}, "XPF")).toBe("1\u202f235 F")
    expect(formatMontantPiece(1234.56, {}, "EUR")).toContain("€")
    expect(formatMontantPiece(1234.56, {}, null)).toBe("—")
  })
  it("garde la devise fournie, même pendant le chargement de la ferme", () => {
    for (const courante of ["XPF", null] as const) {
      expect(formatMontantPiece(12, { monnaie: "EUR" }, courante)).toContain("€")
      expect(formatMontantPiece(12, { factureId: 1, emetteurSnapshot: { devise: "EUR" } }, courante)).toContain("€")
    }
  })
  it("masque une devise inconnue au lieu de remplacer l'identité d'une facture", () => {
    expect(devisePieceAffichage({ monnaie: null }, "XPF")).toBeNull()
    expect(formatMontantPiece(12, { factureId: 1, date: "2026-11-16" }, "XPF")).toBe("—")
    expect(formatMontantPiece(12, { factureId: 1, emetteurSnapshot: { devise: "USD" } }, "EUR")).toBe("—")
  })
  it("refuse de réétiqueter un total mixte ou inconnu", () => {
    expect(totalDansDeviseCourante([{}, { monnaie: "XPF" }], "XPF")).toBe(true)
    expect(totalDansDeviseCourante([{ monnaie: "EUR" }, { monnaie: "XPF" }], "XPF")).toBe(false)
    expect(totalDansDeviseCourante([{ factureId: 1, date: "2026-11-16" }], "XPF")).toBe(false)
    expect(totalDansDeviseCourante([], null)).toBe(false)
  })
})
