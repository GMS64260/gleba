import { describe, expect, it } from "vitest"

import { estEspeceSansDelaiLait } from "../cibles-collecte-lait"

/**
 * QA 2026-07-30 — Un traitement sur un lot de pondeuses affichait « LAIT
 * 03/08/2026 ». Le garde-fou neutralise le délai lait pour les espèces qui n'en
 * produisent pas, mais il ne doit JAMAIS le faire par défaut : un délai de
 * retrait manquant est un risque sanitaire, un délai superflu ne l'est pas.
 */
describe("estEspeceSansDelaiLait", () => {
  it("écarte le délai lait pour une volaille, même déclarée « mixte »", () => {
    expect(estEspeceSansDelaiLait({ nom: "Poule pondeuse", type: "volaille", production: "oeufs" })).toBe(true)
    // Cas réel des poules Sussex/Wyandotte : profil « mixte » viande + œufs.
    expect(estEspeceSansDelaiLait({ nom: "Poule Sussex", type: "volaille", production: "mixte" })).toBe(true)
    expect(estEspeceSansDelaiLait({ nom: "Canard de Rouen", categorieReglementaire: "Volaille de chair", production: "mixte" })).toBe(true)
  })

  it("écarte le délai lait sur une production œufs ou compagnie explicite", () => {
    expect(estEspeceSansDelaiLait({ nom: "Caille", production: "oeufs" })).toBe(true)
    expect(estEspeceSansDelaiLait({ nom: "Chat", production: "compagnie" })).toBe(true)
  })

  it("conserve le délai lait pour les espèces laitières et mixtes non avicoles", () => {
    expect(estEspeceSansDelaiLait({ nom: "Chèvre Alpine", type: "mammifere_petit", production: "lait" })).toBe(false)
    expect(estEspeceSansDelaiLait({ nom: "Brebis Lacaune", type: "mammifere_petit", production: "mixte" })).toBe(false)
    expect(estEspeceSansDelaiLait({ nom: "Vache Montbéliarde", categorieReglementaire: "Bovin", production: "mixte" })).toBe(false)
  })

  it("conserve le délai lait quand l'espèce est inconnue ou incomplète", () => {
    expect(estEspeceSansDelaiLait(null)).toBe(false)
    expect(estEspeceSansDelaiLait(undefined)).toBe(false)
    // Espèce chargée sans production renseignée : aucune preuve, on garde le délai.
    expect(estEspeceSansDelaiLait({ nom: "Espèce ad hoc" })).toBe(false)
    expect(estEspeceSansDelaiLait({ nom: "Mouton", production: "viande" })).toBe(false)
  })

  it("reste insensible à la casse et aux accents du profil", () => {
    expect(estEspeceSansDelaiLait({ nom: "Dinde", type: "VOLAILLE", production: "viande" })).toBe(true)
    expect(estEspeceSansDelaiLait({ nom: "Pintade", categorieReglementaire: "Volaille de Ponte" })).toBe(true)
    expect(estEspeceSansDelaiLait({ nom: "Chèvre", production: "Lait" })).toBe(false)
  })
})
