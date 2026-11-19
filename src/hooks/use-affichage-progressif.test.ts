import { describe, expect, it, vi } from "vitest"

// Pilote minimal de useState : un état, relu au rendu suivant.
const m = vi.hoisted(() => ({ etat: undefined as unknown }))
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useState: (initial: unknown) => {
    if (m.etat === undefined) m.etat = initial
    return [m.etat, (suivant: unknown) => { m.etat = suivant }]
  },
}))

import { useAffichageProgressif } from "./use-affichage-progressif"

const lignes = Array.from({ length: 120 }, (_, i) => i)

describe("affichage progressif d'une longue liste", () => {
  it("montre 50 lignes, puis 50 de plus, puis tout, et repart au début quand le filtre change", () => {
    m.etat = undefined
    let liste = useAffichageProgressif(lignes, "2026:tous")
    expect([liste.visibles.length, liste.reste, liste.total]).toEqual([50, 70, 120])
    liste.afficherPlus()
    liste = useAffichageProgressif(lignes, "2026:tous")
    expect([liste.visibles.length, liste.reste]).toEqual([100, 20])
    liste.afficherTout()
    liste = useAffichageProgressif(lignes, "2026:tous")
    expect([liste.visibles.length, liste.reste]).toEqual([120, 0])
    // Autre filtre : la liste n'est plus la même, on repart des 50 premières.
    liste = useAffichageProgressif(lignes, "2025:tous")
    expect(liste.visibles.length).toBe(50)
  })

  it("rend la liste telle quelle quand elle tient dans une tranche", () => {
    m.etat = undefined
    const courte = [1, 2, 3]
    expect(useAffichageProgressif(courte, "x").visibles).toBe(courte)
  })
})
