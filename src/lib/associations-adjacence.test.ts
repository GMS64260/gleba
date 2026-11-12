import { describe, expect, it, vi } from "vitest"
import { checkAdjacence } from "@/lib/associations-adjacence"

describe("checkAdjacence", () => {
  it("distingue une planche sans îlot d'un îlot sans autre planche", async () => {
    const sansIlot = {
      planche: {
        findFirst: vi.fn().mockResolvedValue({ id: "p1", nom: "P1", ilot: null }),
        findMany: vi.fn(),
      },
    }
    await expect(checkAdjacence("tomate", "p1", "u1", sansIlot as never))
      .resolves.toEqual({
        alertes: [],
        suggestions: [],
        ilot: null,
        planchesVoisines: [],
      })
    expect(sansIlot.planche.findMany).not.toHaveBeenCalled()

    const ilotSansVoisine = {
      planche: {
        findFirst: vi.fn().mockResolvedValue({
          id: "p1",
          nom: "P1",
          ilot: "Jardin test Codex",
        }),
        findMany: vi.fn().mockResolvedValue([]),
      },
    }
    await expect(checkAdjacence("tomate", "p1", "u1", ilotSansVoisine as never))
      .resolves.toEqual({
        alertes: [],
        suggestions: [],
        ilot: "Jardin test Codex",
        planchesVoisines: [],
      })
  })
})

describe("checkAdjacence — îlot occupé", () => {
  const MAINTENANT = new Date(2026, 5, 15, 12)

  const detail = (especeId: string, requise = false) => ({ especeId, requise, espece: { nom: especeId } })
  const culture = (plancheId: string, especeId: string, extra: Record<string, unknown> = {}) => ({
    plancheId,
    especeId,
    annee: 2026,
    terminee: null,
    dateRecolte: null,
    finRecolte: null,
    espece: { vivace: false },
    ...extra,
  })

  const base = (cultures: unknown[], associations: unknown[], voisines = [{ id: "p2", nom: "P2" }]) => ({
    planche: {
      findFirst: vi.fn().mockResolvedValue({ id: "p1", nom: "P1", ilot: "Nord" }),
      findMany: vi.fn().mockResolvedValue(voisines),
    },
    culture: { findMany: vi.fn().mockResolvedValue(cultures) },
    association: { findMany: vi.fn().mockResolvedValue(associations) },
  })

  const ailContre = {
    id: "asso-ail-contre",
    nom: "Ail !",
    type: "incompatible",
    description: null,
    notes: null,
    details: [detail("Ail", true), detail("Haricot"), detail("Pois")],
  }

  it("ne suggère à une compagne que le pivot de la règle, pas les autres compagnes", async () => {
    const poireauPlus = {
      id: "asso-poireau-plus",
      nom: "Poireau +",
      type: "favorable",
      description: null,
      notes: null,
      details: [detail("Poireau", true), detail("Artichaut"), detail("Asperge"), detail("Tomate")],
    }
    const tx = base([culture("p2", "Laitue")], [poireauPlus])
    const res = await checkAdjacence("Tomate", "p1", "u1", tx as never, MAINTENANT)
    expect(res.suggestions.map((s) => s.especeId)).toEqual(["Poireau"])
    expect(res.suggestions[0].message).toBe("Poireau sur une planche adjacente serait bénéfique (Poireau +)")
  })

  it("propose toutes ses compagnes au pivot, sauf celles déjà sur l'îlot", async () => {
    const poireauPlus = {
      id: "asso-poireau-plus",
      nom: "Poireau +",
      type: "favorable",
      description: null,
      notes: null,
      details: [detail("Poireau", true), detail("Artichaut"), detail("Tomate")],
    }
    const tx = base([culture("p2", "Tomate")], [poireauPlus])
    const res = await checkAdjacence("Poireau", "p1", "u1", tx as never, MAINTENANT)
    expect(res.suggestions.map((s) => s.especeId)).toEqual(["Artichaut"])
  })

  it("charge les associations une seule fois, quel que soit le nombre de planches voisines", async () => {
    const voisines = Array.from({ length: 6 }, (_, i) => ({ id: `v${i}`, nom: `V${i}` }))
    const tx = base(
      voisines.map((v, i) => culture(v.id, i % 2 === 0 ? "Haricot" : "Pois")),
      [ailContre],
      voisines
    )
    const res = await checkAdjacence("Ail", "p1", "u1", tx as never, MAINTENANT)
    expect(tx.association.findMany).toHaveBeenCalledTimes(1)
    expect(res.alertes).toHaveLength(6)
    expect(res.alertes.map((a) => a.plancheNom)).toEqual(voisines.map((v) => v.nom))
    expect(res.alertes.every((a) => a.type === "defavorable")).toBe(true)
  })

  it("borne les cultures voisines au propriétaire et aux planches de l'îlot", async () => {
    const tx = base([culture("p2", "Haricot")], [ailContre])
    await checkAdjacence("Ail", "p1", "u1", tx as never, MAINTENANT)
    expect(tx.planche.findFirst.mock.calls[0][0].where).toEqual({ id: "p1", userId: "u1" })
    expect(tx.planche.findMany.mock.calls[0][0].where).toMatchObject({ userId: "u1", ilot: "Nord" })
    expect(tx.culture.findMany.mock.calls[0][0].where).toMatchObject({
      userId: "u1",
      plancheId: { in: ["p2"] },
      terminee: null,
    })
  })

  it("écarte une culture ancienne jamais close ou dont la récolte est finie depuis longtemps", async () => {
    const ancienne = base([culture("p2", "Haricot", { annee: 2024 })], [ailContre])
    await expect(checkAdjacence("Ail", "p1", "u1", ancienne as never, MAINTENANT)).resolves.toMatchObject({
      alertes: [],
    })

    const recoltee = base(
      [culture("p2", "Haricot", { dateRecolte: new Date(2026, 2, 1), finRecolte: new Date(2026, 3, 1) })],
      [ailContre]
    )
    await expect(checkAdjacence("Ail", "p1", "u1", recoltee as never, MAINTENANT)).resolves.toMatchObject({
      alertes: [],
    })
  })

  it("garde une culture en cours de récolte, une culture prévue plus tard et une vivace ancienne", async () => {
    for (const voisine of [
      culture("p2", "Haricot", { dateRecolte: new Date(2026, 5, 1), finRecolte: new Date(2026, 6, 15) }),
      culture("p2", "Haricot", { annee: 2027 }),
      culture("p2", "Haricot", { annee: null }),
      culture("p2", "Haricot", { annee: 2021, espece: { vivace: true } }),
    ]) {
      const tx = base([voisine], [ailContre])
      const res = await checkAdjacence("Ail", "p1", "u1", tx as never, MAINTENANT)
      expect(res.alertes).toHaveLength(1)
      expect(res.alertes[0]).toMatchObject({ type: "defavorable", plancheNom: "P2", especes: ["ail", "haricot"] })
    }
  })

  describe("même planche, alias et période de la candidate", () => {
    const periode = { debut: new Date(2026, 4, 1), fin: new Date(2026, 7, 31) }
    const ailHaricot = {
      id: "asso-ail-haricot",
      nom: "Ail Haricot",
      type: "incompatible",
      description: null,
      notes: null,
      details: [detail("Ail"), detail("Haricot")],
    }
    const dates = (debut: Date, fin: Date) => ({ datePlantation: debut, dateSemis: null, dateRecolte: fin, finRecolte: fin })

    it("sans période, n'examine pas la planche cible (succession ou cohabitation indécidable)", async () => {
      const tx = base([culture("p1", "Ail")], [ailContre])
      const res = await checkAdjacence("Haricot", "p1", "u1", tx as never, MAINTENANT)
      expect(res.alertes).toEqual([])
      expect(tx.culture.findMany.mock.calls[0][0].where.plancheId.in).toEqual(["p2"])
    })

    it("avec période, alerte sur la planche cible quand les cultures cohabitent", async () => {
      const tx = base(
        [culture("p1", "Ail", dates(new Date(2025, 9, 15), new Date(2026, 5, 30)))],
        [ailContre]
      )
      const res = await checkAdjacence("Haricot", "p1", "u1", tx as never, MAINTENANT, periode)
      expect(res.alertes).toHaveLength(1)
      expect(res.alertes[0]).toMatchObject({ type: "defavorable", plancheNom: "P1", memePlanche: true })
    })

    it("avec période, ne signale pas une succession sur la planche cible", async () => {
      const tx = base(
        [culture("p1", "Ail", dates(new Date(2025, 9, 15), new Date(2026, 3, 20)))],
        [ailContre]
      )
      const res = await checkAdjacence("Haricot", "p1", "u1", tx as never, MAINTENANT, periode)
      expect(res.alertes).toEqual([])
    })

    it("avec période, examine la planche cible même sans îlot", async () => {
      const tx = base([culture("p1", "Ail", dates(new Date(2026, 2, 1), new Date(2026, 5, 30)))], [ailContre])
      tx.planche.findFirst.mockResolvedValue({ id: "p1", nom: "P1", ilot: null })
      const res = await checkAdjacence("Haricot", "p1", "u1", tx as never, MAINTENANT, periode)
      expect(tx.planche.findMany).not.toHaveBeenCalled()
      expect(res.alertes).toHaveLength(1)
      expect(res.planchesVoisines).toEqual([])
    })

    it("applique à une variante les règles de son espèce générique", async () => {
      const tx = base([culture("p2", "Ail")], [ailHaricot])
      const res = await checkAdjacence("Haricot vert", "p1", "u1", tx as never, MAINTENANT)
      expect(res.alertes).toHaveLength(1)
      expect([...res.alertes[0].especes].sort()).toEqual(["ail", "haricot vert"])
      const OR = tx.association.findMany.mock.calls[0][0].where.details.some.OR
      expect(OR[0].especeId.in).toEqual(expect.arrayContaining(["haricot vert", "haricot"]))
    })
  })
})
