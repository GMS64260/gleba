import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  naissanceFindMany: vi.fn(),
  abattageGroupBy: vi.fn(),
  animalGroupBy: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  default: {
    naissanceAnimale: { findMany: mocks.naissanceFindMany },
    abattage: { groupBy: mocks.abattageGroupBy },
    animal: { groupBy: mocks.animalGroupBy },
  },
}))

import { reconstituerEffectifsLots } from "../effectif"

/**
 * `animal.groupBy` et `abattage.groupBy` sont appelés deux fois chacun, avec des
 * filtres différents (fiches actives vs sorties, abattages du lot vs abattages
 * déjà rattachés à une fiche). Les mocks répondent donc selon le `where`.
 */
const mockAnimaux = ({ actifs = [] as unknown[], sorties = [] as unknown[] } = {}) => {
  mocks.animalGroupBy.mockImplementation(async (args: any) =>
    args?.where?.statut?.not === "actif" ? sorties : actifs,
  )
}
const mockAbattages = ({ lot = [] as unknown[], nominatifs = [] as unknown[] } = {}) => {
  mocks.abattageGroupBy.mockImplementation(async (args: any) =>
    args?.where?.animalId ? nominatifs : lot,
  )
}

describe("reconstituerEffectifsLots", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAbattages()
    mockAnimaux()
  })

  it("ne recherche que les naissances explicitement rattachées aux lots", async () => {
    mocks.naissanceFindMany.mockResolvedValue([])
    await reconstituerEffectifsLots("u1", [{ id: 4, quantiteInitiale: 10, quantiteActuelle: 10 }])
    expect(mocks.naissanceFindMany).toHaveBeenCalledWith({
      where: { userId: "u1", lotId: { in: [4] } },
      select: { lotId: true, nombreVivants: true },
    })
  })

  it("soustrait les abattages sans dépasser le compteur stocké prudent", async () => {
    mocks.naissanceFindMany.mockResolvedValue([{ lotId: 4, nombreVivants: 3 }])
    mockAbattages({ lot: [{ lotId: 4, _sum: { quantite: 5 } }] })
    const result = await reconstituerEffectifsLots("u1", [{ id: 4, quantiteInitiale: 10, quantiteActuelle: 12 }])
    expect(result.get(4)?.effectifCalcule).toBe(8)
  })

  // Ticket QA caprin cmrz0mt8c (2026-07-24) — les naissances individualisées en
  // fiches quittent le comptage anonyme (`quantiteActuelle` redescend) mais
  // deviennent des animaux nominatifs rattachés au lot : elles doivent être
  // réintégrées, sinon l'effectif fige.
  it("réintègre les naissances individualisées en fiches nominatives", async () => {
    // Lot : 6 initial, +3 naissances vivantes, 3 fiches créées → quantiteActuelle
    // redescendue à 6. Effectif réel attendu : 6 anonymes… non, 6 = 3 anonymes
    // restants + 3 nominatifs ; ici quantiteActuelle=6 + 3 nominatifs plafonné à 9.
    mocks.naissanceFindMany.mockResolvedValue([{ lotId: 51, nombreVivants: 3 }])
    mockAnimaux({ actifs: [{ lotId: 51, _count: { _all: 3 } }] })
    const result = await reconstituerEffectifsLots("u1", [
      { id: 51, quantiteInitiale: 6, quantiteActuelle: 6 },
    ])
    expect(result.get(51)?.effectifCalcule).toBe(9)
  })

  it("plafonne les affectations nominatives surnuméraires par les mouvements tracés", async () => {
    // 2 animaux nominatifs affectés manuellement (sans décrément du compteur),
    // initial 3 + 2 naissances : le plafond tracé (5) borne le total.
    mocks.naissanceFindMany.mockResolvedValue([{ lotId: 50, nombreVivants: 2 }])
    mockAnimaux({ actifs: [{ lotId: 50, _count: { _all: 2 } }] })
    const result = await reconstituerEffectifsLots("u1", [
      { id: 50, quantiteInitiale: 3, quantiteActuelle: 5 },
    ])
    expect(result.get(50)?.effectifCalcule).toBe(5)
  })

  // Ticket cmsogdr7i — le plafond tracé ignorait les affectations MANUELLES de
  // fiches nominatives : un lot de 4 entièrement individualisé auquel on
  // rattache une 5e fiche affichait « 4 effectif actuel » face à 5 nominatifs.
  // Les fiches actives rattachées sont des présences réelles : elles
  // planchonnent l'effectif calculé.
  it("ne descend jamais sous les fiches nominatives actives (affectation manuelle au-delà de la quantité initiale)", async () => {
    // Lot entièrement individualisé (quantiteActuelle: 0), 4 initial, aucune
    // naissance/abattage tracé → plafond 4. Une 5e fiche affectée manuellement
    // doit porter l'effectif à 5, pas rester bornée à 4.
    mocks.naissanceFindMany.mockResolvedValue([])
    mockAnimaux({ actifs: [{ lotId: 58, _count: { _all: 5 } }] })
    const result = await reconstituerEffectifsLots("u1", [
      { id: 58, quantiteInitiale: 4, quantiteActuelle: 0 },
    ])
    expect(result.get(58)?.effectifCalcule).toBe(5)
    expect(result.get(58)?.nominatifsActifs).toBe(5)
  })

  // QA cmswxat0n — le décès d'une fiche nominative rattachée à un lot ne
  // décrémentait rien : ni `quantiteActuelle` (comptage anonyme) ni le plafond
  // tracé. Un lot de 2 têtes + 2 naissances affichait toujours 4 après la mort
  // de sa seule fiche nominative, et le dashboard comptait un actif de trop.
  it("retranche du lot la fiche nominative décédée", async () => {
    mocks.naissanceFindMany.mockResolvedValue([{ lotId: 71, nombreVivants: 2 }])
    mockAnimaux({ actifs: [], sorties: [{ lotId: 71, _count: { _all: 1 } }] })
    const result = await reconstituerEffectifsLots("u1", [
      { id: 71, quantiteInitiale: 2, quantiteActuelle: 4 },
    ])
    expect(result.get(71)?.effectifCalcule).toBe(3)
    expect(result.get(71)?.sortiesNominatives).toBe(1)
  })

  // Un abattage saisi sur la fiche nominative décrémente déjà le lot : il ne
  // doit pas être retranché une seconde fois au titre de la sortie de fiche.
  it("ne compte pas deux fois un abattage saisi sur une fiche du lot", async () => {
    mocks.naissanceFindMany.mockResolvedValue([])
    mockAbattages({
      lot: [{ lotId: 72, _sum: { quantite: 1 } }],
      nominatifs: [{ lotId: 72, _count: { _all: 1 } }],
    })
    mockAnimaux({ actifs: [], sorties: [{ lotId: 72, _count: { _all: 1 } }] })
    const result = await reconstituerEffectifsLots("u1", [
      { id: 72, quantiteInitiale: 4, quantiteActuelle: 3 },
    ])
    expect(result.get(72)?.effectifCalcule).toBe(3)
    expect(result.get(72)?.sortiesNominatives).toBe(0)
  })

  // Une fiche active planchonne toujours l'effectif : retrancher les sorties ne
  // doit pas faire disparaître un animal réellement présent (lot 58 en prod).
  it("garde les fiches actives malgré une sortie nominative", async () => {
    mocks.naissanceFindMany.mockResolvedValue([])
    mockAnimaux({
      actifs: [{ lotId: 58, _count: { _all: 4 } }],
      sorties: [{ lotId: 58, _count: { _all: 1 } }],
    })
    const result = await reconstituerEffectifsLots("u1", [
      { id: 58, quantiteInitiale: 4, quantiteActuelle: 4 },
    ])
    expect(result.get(58)?.effectifCalcule).toBe(4)
  })
})
