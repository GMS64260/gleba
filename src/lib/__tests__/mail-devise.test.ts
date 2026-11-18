import { describe, expect, it } from "vitest"
import { commandeBoutiqueEmail, commandeClientConfirmationEmail, commandeStatutClientEmail } from "../mail"

const args = { boutiqueNom: "Ferme fictive", producteurNom: null, numero: "CMD-FICTIVE", slug: "ferme-fictive", suiviToken: "jeton-fictif", clientNom: "Client fictif", clientEmail: "client@example.test", clientTelephone: null, total: 1234.56, lignes: [{ nom: "Carottes", quantite: 1, unite: "kg", prixUnitaire: 1234.56, total: 1234.56 }], modeLivraison: null, dateRetraitSouhaitee: null, notesClient: null, modesPaiement: null, statut: "prete" }
describe.each([commandeBoutiqueEmail, commandeClientConfirmationEmail, commandeStatutClientEmail])("devise explicite des courriels boutique — %s", (rendre) => {
  it.each([["XPF", "1 235 F"], ["EUR", "1 234,56 €"], [null, "—"]] as const)("affiche %s sans inventer de devise", (devise, attendu) => {
    const html = rendre({ ...args, devise }).html.replace(/[\u00a0\u202f]/g, " ")
    expect(html).toContain(attendu)
    if (devise !== "EUR") expect(html).not.toContain("€")
  })
})
