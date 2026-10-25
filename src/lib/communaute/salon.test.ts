import { describe, expect, it } from "vitest"
import {
  ajouterPageAncienneSalon,
  fusionnerFenetreSalon,
  libelleJourSalon,
  nomAuteurSalon,
  type MessageSalonVue,
} from "./salon"

function msg(id: string, minute: number): MessageSalonVue {
  return {
    id,
    contenu: id,
    createdAt: new Date(Date.UTC(2026, 9, 25, 9, minute)).toISOString(),
    auteur: { nom: "X", estMoi: false, equipe: false },
    supprimable: false,
  }
}

const ids = (l: MessageSalonVue[]) => l.map((m) => m.id)

describe("nomAuteurSalon", () => {
  it("rend le nom du compte, ou un nom générique, jamais autre chose", () => {
    expect(nomAuteurSalon(" Camille ")).toBe("Camille")
    expect(nomAuteurSalon("")).toBe("Membre de Gleba")
    expect(nomAuteurSalon(null)).toBe("Membre de Gleba")
  })
})

describe("fusionnerFenetreSalon", () => {
  it("une fenêtre complète remplace le fil (un message supprimé disparaît)", () => {
    const affiches = [msg("a", 1), msg("b", 2), msg("c", 3)]

    const fil = fusionnerFenetreSalon(affiches, { messages: [msg("a", 1), msg("c", 3)], plusAnciens: false })

    expect(ids(fil)).toEqual(["a", "c"])
  })

  it("garde l'historique chargé avant la fenêtre et prend la fenêtre pour le reste", () => {
    // Fil : deux pages d'historique (a, b) + fenêtre (c, d, e). Depuis, d a été
    // supprimé et f publié.
    const affiches = [msg("a", 1), msg("b", 2), msg("c", 3), msg("d", 4), msg("e", 5)]

    const fil = fusionnerFenetreSalon(affiches, {
      messages: [msg("c", 3), msg("e", 5), msg("f", 6)],
      plusAnciens: true,
    })

    expect(ids(fil)).toEqual(["a", "b", "c", "e", "f"])
  })

  it("une fenêtre vide vide le fil", () => {
    expect(fusionnerFenetreSalon([msg("a", 1)], { messages: [], plusAnciens: false })).toEqual([])
  })
})

describe("ajouterPageAncienneSalon", () => {
  it("ajoute en tête sans doublon", () => {
    const fil = ajouterPageAncienneSalon([msg("b", 2), msg("c", 3)], [msg("a", 1), msg("b", 2)])

    expect(ids(fil)).toEqual(["a", "b", "c"])
  })
})

describe("libelleJourSalon", () => {
  const maintenant = new Date(2026, 9, 25, 15, 0)

  it("dit aujourd'hui et hier", () => {
    expect(libelleJourSalon(new Date(2026, 9, 25, 0, 5), maintenant)).toBe("Aujourd'hui")
    expect(libelleJourSalon(new Date(2026, 9, 24, 23, 59), maintenant)).toBe("Hier")
  })

  it("date les jours plus anciens, avec l'année seulement si elle diffère", () => {
    expect(libelleJourSalon(new Date(2026, 9, 12, 10, 0), maintenant)).toBe("lundi 12 octobre")
    expect(libelleJourSalon(new Date(2025, 11, 31, 10, 0), maintenant)).toBe("mercredi 31 décembre 2025")
  })
})
