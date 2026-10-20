import { describe, expect, it } from "vitest"

/**
 * QA cmvgeltj1 (2026-10-20) — un traitement du registre Verger (0,01 ha, ZNT
 * 20 m respectée, 15 °C / vent 5 / hygrométrie 70 / sans pluie, opérateur
 * « v8-Hélène ») ressortait au registre général avec Surface « Manquant »,
 * Météo « - » et l'exploitation pour applicateur.
 */
import {
  applicateurPhyto,
  libelleMeteoPhyto,
  notesAvecOperateur,
  operateurDansNotes,
  operateurPhyto,
  surfaceRegistreM2,
} from "../projection-phyto"

const compte = { name: "Ferme test", email: "ferme@example.test" }

describe("surfaceRegistreM2", () => {
  it("convertit les hectares du formulaire Verger : 0,01 ha = 100 m²", () => {
    expect(surfaceRegistreM2({ surfaceTraiteeHa: 0.01 })).toBe(100)
    expect(surfaceRegistreM2({ surfaceTraiteeHa: 0.08 })).toBe(800)
  })

  it("garde les m² saisis par Interventions en priorité", () => {
    expect(surfaceRegistreM2({ surfaceTraitee: 250, surfaceTraiteeHa: 0.5 })).toBe(250)
  })

  it("rien de saisi : null (le registre affiche « Manquant »)", () => {
    expect(surfaceRegistreM2({})).toBeNull()
    expect(surfaceRegistreM2({ surfaceTraitee: 0, surfaceTraiteeHa: null })).toBeNull()
  })
})

describe("libelleMeteoPhyto", () => {
  it("compose les relevés structurés du formulaire", () => {
    expect(
      libelleMeteoPhyto({ temperatureC: 15, ventKmh: 5, hygrometriePct: 70, pluie24h: false }),
    ).toBe("15 °C · vent 5 km/h · hygrométrie 70 % · sans pluie ±24 h")
  })

  it("pluie avec hauteur, décimales à la française", () => {
    expect(libelleMeteoPhyto({ temperatureC: 12.5, pluie24h: true, pluie24hMm: 2.5 })).toBe(
      "12,5 °C · pluie ±24 h (2,5 mm)",
    )
  })

  it("le texte libre historique prime ; rien de saisi : null", () => {
    expect(libelleMeteoPhyto({ conditionsMeteo: "Ensoleillé", temperatureC: 15 })).toBe("Ensoleillé")
    expect(libelleMeteoPhyto({ conditionsMeteo: "  ", temperatureC: null })).toBeNull()
  })
})

describe("opérateur saisi en texte libre", () => {
  it("relit la ligne écrite par le formulaire Verger > Santé & Phyto", () => {
    expect(operateurDansNotes("Opérateur : v8-Hélène")).toBe("v8-Hélène")
    expect(operateurDansNotes("Feuilles sèches\nOpérateur : Paul")).toBe("Paul")
  })

  it("relit la mention de Verger > Opérations (« notes — Opérateur : … »)", () => {
    expect(operateurDansNotes("Préventif — Opérateur : Marc")).toBe("Marc")
  })

  it("relit une trace détachée d'arbre supprimé", () => {
    expect(operateurDansNotes("[Arbre supprimé : Prunier 5 (Prunier)]\nOpérateur : v8-Hélène")).toBe("v8-Hélène")
  })

  it("revue : « Opérateur : » laissé vide ne prend pas la ligne suivante", () => {
    expect(operateurDansNotes("Opérateur :\nPluie la veille, reprise conseillée")).toBeNull()
    expect(
      applicateurPhyto({ operateur: null, notes: "Opérateur :\nPluie la veille", user: { name: "Ferme test", email: null } }),
    ).toBe("Ferme test")
  })

  it("revue : le nom s'arrête au séparateur « — », le dernier mentionné l'emporte", () => {
    expect(operateurDansNotes("Opérateur : X — Opérateur : Y")).toBe("Y")
    expect(operateurDansNotes("Opérateur : Marc — note libre")).toBe("Marc")
  })

  it("ignore une note sans opérateur", () => {
    expect(operateurDansNotes("Coopérateur: non")).toBeNull()
    expect(operateurDansNotes(null)).toBeNull()
  })

  it("notesAvecOperateur ajoute la ligne une seule fois", () => {
    expect(notesAvecOperateur("", "v8-Hélène")).toBe("Opérateur : v8-Hélène")
    expect(notesAvecOperateur("Bord du ruisseau", " Paul ")).toBe("Bord du ruisseau\nOpérateur : Paul")
    // Ancien écran : la ligne est déjà composée.
    expect(notesAvecOperateur("Opérateur : v8-Hélène", "v8-Hélène")).toBe("Opérateur : v8-Hélène")
    expect(notesAvecOperateur(null, null)).toBeNull()
  })
})

describe("applicateurPhyto", () => {
  it("opérateur saisi plutôt que le titulaire du compte", () => {
    expect(applicateurPhyto({ operateur: null, notes: "Opérateur : v8-Hélène", user: compte })).toBe("v8-Hélène")
    expect(operateurPhyto({ operateur: null, notes: "Opérateur : v8-Hélène" })).toBe("v8-Hélène")
  })

  it("le compte opérateur désigné prime, le titulaire en dernier recours", () => {
    expect(applicateurPhyto({ operateur: { name: "Lise", email: null }, notes: "Opérateur : Paul", user: compte })).toBe("Lise")
    expect(applicateurPhyto({ operateur: null, notes: null, user: compte })).toBe("Ferme test")
    expect(operateurPhyto({ operateur: null, notes: null })).toBeNull()
  })
})
