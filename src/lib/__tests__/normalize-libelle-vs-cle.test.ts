import { describe, expect, it } from "vitest"

import {
  cleanReferentielName,
  displayReferentielName,
  normalizeReferentielKey,
} from "@/lib/normalize"

/**
 * QA cmswxyuoi — un libellé et une clé de comparaison n'ont pas les mêmes
 * règles. La même fonction servait aux deux : le nom saisi
 * « TEST-Marc-Phacelie-v7 » était enregistré « TEST Marc Phacelie v7 », donc
 * introuvable par le nom tapé, et l'utilisateur en concluait que sa saisie
 * avait été perdue.
 */
describe("libellé affiché vs clé de dédup", () => {
  it("conserve le libellé tel que saisi, tirets compris", () => {
    expect(displayReferentielName("TEST-Marc-Phacelie-v7")).toBe("TEST-Marc-Phacelie-v7")
    expect(displayReferentielName("Chou-fleur d'hiver")).toBe("Chou-fleur d'hiver")
  })

  it("réduit seulement le bruit d'espaces", () => {
    expect(displayReferentielName("  Radis   été  ")).toBe("Radis été")
  })

  it("garde la clé de dédup insensible à la ponctuation", () => {
    expect(normalizeReferentielKey("Carotte-Nantaise")).toBe(
      normalizeReferentielKey("carotte nantaise"),
    )
    expect(normalizeReferentielKey("TEST-Marc-Phacelie-v7")).toBe("test marc phacelie v7")
  })

  it("laisse cleanReferentielName au service de la seule comparaison", () => {
    // Comportement inchangé : c'est la brique de la clé, pas du libellé.
    expect(cleanReferentielName("Chou_fleur-hiver")).toBe("Chou fleur hiver")
  })
})
