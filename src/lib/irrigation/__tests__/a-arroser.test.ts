/**
 * Refonte de l'arrosage (2026-10-10) : une planche est « à arroser
 * aujourd'hui » quand le bilan hydrique d'une de ses cultures est en urgence
 * critique ou haute. Plus de plan pré-généré.
 */
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/irrigation-conseil", () => ({ computeConseilIrrigation: vi.fn() }))

import { arrosagesDuJour, type CultureConseil } from "../a-arroser"

function culture(id: number, urgence: string, planche: CultureConseil["planche"], espece = "Tomate"): CultureConseil {
  return {
    id,
    aIrriguer: true,
    urgence,
    raisonUrgence: `raison ${id}`,
    sousAbri: false,
    espece: { nom: espece },
    planche,
  }
}

const A3 = { id: "p-a3", nom: "A3", ilot: "Nord" }
const B1 = { id: "p-b1", nom: "B1", ilot: "Nord" }

describe("arrosagesDuJour", () => {
  it("ne retient que les urgences critique et haute", () => {
    const lignes = arrosagesDuJour([
      culture(1, "moyenne", A3),
      culture(2, "faible", B1),
      culture(3, "aucune", A3),
    ])
    expect(lignes).toEqual([])
  })

  it("une ligne par planche : un passage arrose toutes ses cultures", () => {
    const lignes = arrosagesDuJour([
      culture(1, "haute", A3, "Tomate"),
      culture(2, "critique", A3, "Basilic"),
      culture(3, "moyenne", A3, "Persil"),
    ])
    expect(lignes).toHaveLength(1)
    expect(lignes[0]).toMatchObject({
      cle: "planche:p-a3",
      plancheRefId: "p-a3",
      plancheNom: "A3",
      // Seules les cultures en besoin sont notées ensemble ; la moyenne attend.
      cultureIds: [1, 2],
      especes: "Tomate + Basilic",
      // La plus forte urgence de la planche, et sa raison.
      urgence: "critique",
      raison: "raison 2",
    })
  })

  it("une culture décochée « à irriguer » ne fait pas de ligne, même en urgence critique", () => {
    const decochee = { ...culture(1, "critique", A3), aIrriguer: false }
    expect(arrosagesDuJour([decochee, culture(2, "haute", B1)]).map((l) => l.plancheNom)).toEqual(["B1"])
  })

  it("une culture sans planche fait sa propre ligne", () => {
    const lignes = arrosagesDuJour([culture(7, "haute", null, "Courge")])
    expect(lignes).toEqual([
      expect.objectContaining({ cle: "culture:7", plancheRefId: null, plancheNom: null, cultureIds: [7], especes: "Courge" }),
    ])
  })

  it("trie le critique avant le haut, puis par planche", () => {
    const lignes = arrosagesDuJour([
      culture(1, "haute", B1),
      culture(2, "haute", A3),
      culture(3, "critique", { id: "p-c2", nom: "C2", ilot: "Sud" }),
    ])
    expect(lignes.map((l) => l.plancheNom)).toEqual(["C2", "A3", "B1"])
  })

  it("une planche sous abri le signale", () => {
    const sousAbri = { ...culture(1, "haute", A3), sousAbri: true }
    expect(arrosagesDuJour([sousAbri])[0].sousAbri).toBe(true)
  })
})

// Ticket QA cmv3japsf, étendu aux Tâches et au Calendrier : « Noter » y
// demande la quantité versée, préremplie comme sur le conseiller.
describe("quantité conseillée d'une ligne", () => {
  const A3_DIM = { ...A3, surface: 12, largeur: 0.8, longueur: 25 }

  it("L/m² de la culture pilote et surface de la planche", () => {
    const [ligne] = arrosagesDuJour([{ ...culture(1, "haute", A3_DIM), reserve: { litresParM2: 20 } }])
    // La surface de la planche (12 m²), pas la portion de la culture : les
    // litres notés se répartissent sur toute la planche.
    expect(ligne).toMatchObject({ litresParM2: 20, surfaceM2: 12 })
  })

  it("à urgence égale, la plus forte dose pilote, comme sur le conseiller", () => {
    const [ligne] = arrosagesDuJour([
      { ...culture(1, "haute", A3_DIM, "Laitue"), reserve: { litresParM2: 8 } },
      { ...culture(2, "haute", A3_DIM, "Tomate"), reserve: { litresParM2: 25 } },
    ])
    expect(ligne).toMatchObject({ litresParM2: 25, raison: "raison 2" })
    // La plus forte urgence passe avant la dose.
    const [critique] = arrosagesDuJour([
      { ...culture(1, "critique", A3_DIM), reserve: { litresParM2: 8 } },
      { ...culture(2, "haute", A3_DIM), reserve: { litresParM2: 25 } },
    ])
    expect(critique.litresParM2).toBe(8)
  })

  it("sans météo pas de dose ; sans planche ou sans dimension, surface inconnue", () => {
    expect(arrosagesDuJour([culture(1, "haute", A3)])[0]).toMatchObject({ litresParM2: null, surfaceM2: 0 })
    const seule = { ...culture(7, "haute", null), reserve: { litresParM2: 5 } }
    expect(arrosagesDuJour([seule])[0]).toMatchObject({ litresParM2: 5, surfaceM2: 0 })
  })
})
