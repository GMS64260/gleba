import { describe, expect, it, vi } from "vitest"
import {
  alertesAssociations,
  classeAssociation,
  evaluerAssociations,
  partenairesSelonPivot,
  type AssociationEvaluable,
} from "@/lib/associations-alertes"

const detail = (especeId: string | null, requise = false, extra: Record<string, unknown> = {}) => ({
  especeId,
  requise,
  espece: especeId ? { nom: especeId } : null,
  ...extra,
})

const asso = (
  id: string,
  nom: string,
  type: string,
  details: ReturnType<typeof detail>[],
  extra: Partial<AssociationEvaluable> = {}
): AssociationEvaluable => ({ id, nom, type, description: null, notes: null, details, ...extra })

describe("classeAssociation", () => {
  it("lit le champ type, et le nom seulement à défaut", () => {
    expect(classeAssociation("incompatible", "Laitue Tomate")).toBe("defavorable")
    expect(classeAssociation("neutre", "Ail incompat")).toBe("neutre")
    expect(classeAssociation(null, "Ail Pois incompatible")).toBe("defavorable")
    expect(classeAssociation(undefined, "Ail + Carotte")).toBe("favorable")
  })
})

describe("partenairesSelonPivot", () => {
  const ids = (details: ReturnType<typeof detail>[], sujet: string) =>
    partenairesSelonPivot(details, (id) => id === sujet).map((d) => d.especeId)

  const etoile = [detail("Poireau", true), detail("Artichaut"), detail("Tomate"), detail(null)]

  it("étoile : le pivot a toutes les compagnes, une compagne n'a que le pivot", () => {
    expect(ids(etoile, "Poireau")).toEqual(["Artichaut", "Tomate"])
    expect(ids(etoile, "Tomate")).toEqual(["Poireau"])
  })

  it("plusieurs pivots : chacun est partenaire de tous les autres membres", () => {
    const milpa = [detail("Courge", true), detail("Haricot", true), detail("Maïs", true)]
    expect(ids(milpa, "Haricot")).toEqual(["Courge", "Maïs"])
  })

  it("couple sans pivot : l'autre membre", () => {
    expect(ids([detail("Ail"), detail("Pois")], "Pois")).toEqual(["Ail"])
  })

  it("espèce absente de l'association, ou seule : aucun partenaire", () => {
    expect(ids(etoile, "Carotte")).toEqual([])
    expect(ids([detail("Ail", true), detail("Ail")], "Ail")).toEqual([])
  })
})

describe("evaluerAssociations", () => {
  it("n'émet qu'une alerte par paire quand deux règles la portent", () => {
    const res = evaluerAssociations(
      [
        asso("b-carotte-poireau", "Carotte + Poireau", "favorable", [detail("Carotte", true), detail("Poireau", true)]),
        asso("a-carotte-poireau", "Carotte-Poireau", "favorable", [detail("Carotte", true), detail("Poireau", true)]),
      ],
      ["Carotte", "Poireau"]
    )
    expect(res).toHaveLength(1)
    // Ordre déterministe : la règle de plus petit identifiant l'emporte.
    expect(res[0].associationId).toBe("a-carotte-poireau")
  })

  it("donne la priorité à la règle défavorable quand deux règles se contredisent", () => {
    const favorable = asso("a-groseillier-plus", "Groseillier +", "favorable", [
      detail("Groseillier", true),
      detail("Haricot"),
    ])
    const defavorable = asso("z-groseillier-contre", "Groseillier !", "incompatible", [
      detail("Groseillier", true),
      detail("Haricot"),
    ])
    for (const ordre of [
      [favorable, defavorable],
      [defavorable, favorable],
    ]) {
      const res = evaluerAssociations(ordre, ["Haricot", "Groseillier"])
      expect(res).toHaveLength(1)
      expect(res[0].type).toBe("defavorable")
      expect(res[0].associationId).toBe("z-groseillier-contre")
    }
  })

  it("nomme les espèces par leur nom, et garde les identifiants en minuscules", () => {
    const res = evaluerAssociations(
      [
        asso("asso-ail-perso", "Ail !", "incompatible", [
          detail("Ail", true),
          detail("cmabc123", false, { espece: { nom: "Haricot du jardin" } }),
        ]),
      ],
      ["Ail", "cmABC123"]
    )
    expect(res).toHaveLength(1)
    expect(res[0].especes).toEqual(["ail", "cmabc123"])
    expect(res[0].message).toBe("Association défavorable : Ail ↔ Haricot du jardin — Ail !")
  })

  it("justifie la paire par la note de la compagne, pas par la description d'une autre", () => {
    const brocoli = asso(
      "asso-brocoli",
      "Chou brocoli +",
      "favorable",
      [
        detail("Chou brocoli", true),
        detail("Concombre", false, { notes: "Bon voisinage.\n\n(Réciproque)" }),
        detail("Oignon"),
      ],
      { description: "Concombre: Bon voisinage. (Réciproque)" }
    )
    const oignon = evaluerAssociations([brocoli], ["Chou brocoli", "Oignon"])
    expect(oignon[0].message).toBe("Association favorable : Chou brocoli ↔ Oignon — Chou brocoli +")
    const concombre = evaluerAssociations([brocoli], ["Chou brocoli", "Concombre"])
    expect(concombre[0].message).toBe(
      "Association favorable : Chou brocoli ↔ Concombre — Bon voisinage. (Réciproque)"
    )
  })

  it("garde la description d'un couple à deux espèces", () => {
    const res = evaluerAssociations(
      [
        asso("asso-ail-pois", "Ail Pois", "incompatible", [detail("Ail"), detail("Pois")], {
          description: "L'ail freine les légumineuses.",
        }),
      ],
      ["Pois", "Ail"]
    )
    expect(res[0].message).toBe("Association défavorable : Pois ↔ Ail — L'ail freine les légumineuses.")
  })

  it("ignore les associations neutres et une espèce face à elle-même", () => {
    expect(
      evaluerAssociations([asso("n", "Ail Thym", "neutre", [detail("Ail"), detail("Thym")])], ["Ail", "Thym"])
    ).toEqual([])
    expect(
      evaluerAssociations([asso("s", "Ail +", "favorable", [detail("Ail", true), detail("Ail")])], ["Ail", "ail"])
    ).toEqual([])
  })

  it("tolère des détails sans nom d'espèce ni note", () => {
    const res = evaluerAssociations(
      [
        {
          id: "x",
          nom: "Ail Carotte +",
          type: "favorable",
          details: [{ especeId: "Ail" }, { especeId: "Carotte" }],
        },
      ],
      ["Ail", "Carotte"]
    )
    expect(res[0].message).toBe("Association favorable : Ail ↔ Carotte — Ail Carotte +")
  })
})

describe("alertesAssociations", () => {
  it("charge les détails dans un ordre stable, avec le nom des espèces", async () => {
    const findMany = vi.fn().mockResolvedValue([])
    await alertesAssociations({ association: { findMany } } as never, ["Ail", "Pois"])
    expect(findMany).toHaveBeenCalledTimes(1)
    expect(findMany.mock.calls[0][0].include).toEqual({
      details: { orderBy: { id: "asc" }, include: { espece: { select: { id: true, nom: true } } } },
    })
  })

  it("ne lit pas la base pour moins de deux espèces", async () => {
    const findMany = vi.fn()
    await expect(alertesAssociations({ association: { findMany } } as never, ["Ail"])).resolves.toEqual([])
    expect(findMany).not.toHaveBeenCalled()
  })
})

describe("evaluerAssociations — alias, groupes et familles", () => {
  const contexte = new Map([
    ["ail", { nom: "Ail", familleId: "Alliaceae" }],
    ["oignon", { nom: "Oignon", familleId: "Alliaceae" }],
    ["tomate", { nom: "Tomate", familleId: "Solanaceae" }],
    ["haricot vert", { nom: "Haricot vert", familleId: "Fabaceae" }],
    ["fenouil", { nom: "Fenouil", familleId: "Apiaceae" }],
    ["chou-fleur", { nom: "Chou-fleur", familleId: "Brassicaceae" }],
    ["chou brocoli", { nom: "Chou brocoli", familleId: "Brassicaceae" }],
    ["carotte", { nom: "Carotte", familleId: "Apiaceae" }],
  ])
  const ailHaricot = asso("asso-ail-haricot", "asso-ail-haricot", "incompatible", [detail("Ail"), detail("Haricot")])
  const tomateContre = asso("tomate-contre", "tomate-contre", "incompatible", [
    detail("Tomate", true),
    detail(null, false, { familleId: "Alliaceae" }),
  ])
  const ailTomate = asso("ail-tomate", "ail-tomate", "favorable", [detail("Ail", true), detail("Tomate")])
  const chouFenouil = asso("chou-fenouil", "chou-fenouil", "incompatible", [
    detail("Fenouil", true, { familleId: "Apiaceae" }),
    detail(null, false, { familleId: "Brassicaceae", groupe: "Chou" }),
  ])

  it("applique à une variante les règles de son espèce générique, sous son identifiant réel", () => {
    const res = evaluerAssociations([ailHaricot], ["Ail", "Haricot vert"], contexte)
    expect(res).toHaveLength(1)
    expect(res[0].type).toBe("defavorable")
    expect([...res[0].especes].sort()).toEqual(["ail", "haricot vert"])
    expect(res[0].niveau).toBe("alias")
    expect(res[0].message).toContain("Ail ↔ Haricot vert")
    expect(res[0].message).toContain("règle portant sur Haricot")
  })

  it("lit une ligne de famille seule, pas la famille d'annotation d'une espèce", () => {
    const res = evaluerAssociations([tomateContre], ["Tomate", "Oignon"], contexte)
    expect(res.map((a) => [a.type, a.niveau])).toEqual([["defavorable", "famille"]])
    // « Chou Fenouil ! » : Apiaceae n'est que l'annotation du fenouil.
    expect(evaluerAssociations([chouFenouil], ["Carotte", "Chou-fleur"], contexte)).toEqual([])
  })

  it("lit une ligne de groupe par les alias de l'espèce", () => {
    const res = evaluerAssociations([chouFenouil], ["Fenouil", "Chou-fleur"], contexte)
    expect(res.map((a) => [a.type, a.niveau])).toEqual([["defavorable", "groupe"]])
  })

  it("fait gagner la règle d'espèce sur la règle de famille qui la contredit", () => {
    const res = evaluerAssociations([tomateContre, ailTomate], ["Ail", "Tomate"], contexte)
    expect(res).toHaveLength(1)
    expect(res[0]).toMatchObject({ type: "favorable", associationId: "ail-tomate", niveau: "espece" })
  })

  it("ne forme pas de paire avec deux espèces tombant sur le même détail", () => {
    expect(evaluerAssociations([chouFenouil], ["Chou-fleur", "Chou brocoli"], contexte)).toEqual([])
  })

  it("respecte le pivot pour les familles : deux compagnes ne sont pas reliées", () => {
    const romarin = asso("romarin-contre", "romarin-contre", "incompatible", [
      detail("Romarin", true),
      detail(null, false, { familleId: "Solanaceae" }),
      detail(null, false, { familleId: "Apiaceae" }),
    ])
    expect(evaluerAssociations([romarin], ["Tomate", "Carotte"], contexte)).toEqual([])
  })

  it("sans contexte, ignore les familles sans planter", () => {
    expect(evaluerAssociations([tomateContre], ["Tomate", "Oignon"])).toEqual([])
  })
})

describe("alertesAssociations — chargement élargi", () => {
  it("cherche aussi les alias, les groupes et les familles seules", async () => {
    const findMany = vi.fn().mockResolvedValue([])
    const tx = {
      association: { findMany },
      espece: { findMany: vi.fn().mockResolvedValue([{ id: "Haricot vert", nom: "Haricot vert", familleId: "Fabaceae" }]) },
    }
    await alertesAssociations(tx as never, ["Ail", "Haricot vert"])
    const OR = findMany.mock.calls[0][0].where.details.some.OR
    expect(OR[0].especeId.in).toEqual(expect.arrayContaining(["ail", "haricot vert", "haricot"]))
    expect(OR[1]).toMatchObject({ especeId: null })
    expect(OR[2]).toEqual({ especeId: null, familleId: { in: ["Fabaceae"] } })
  })
})
