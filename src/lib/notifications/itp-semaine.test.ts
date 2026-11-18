import { describe, expect, it } from "vitest"
import {
  operationsItp,
  operationsItpDansSemaine,
  resumeTachesItpSemaine,
  semaineCourante,
  tachesItpSemainePourCultures,
} from "./itp-semaine"
import type { CultureItpInput, ItpSemaineInput } from "./itp-semaine"

// Référence fixe : mardi 11 août 2026 → semaine ISO 33 (lundi 10 → dimanche 16).
const REFERENCE = new Date(2026, 7, 11)

function itp(overrides: Partial<ItpSemaineInput> = {}): ItpSemaineInput {
  return {
    id: "ITP-Test",
    zoneClimat: null,
    semaineSemis: null,
    semainePlantation: null,
    semaineRecolte: null,
    semaineRecolteFin: null,
    dureeRecolte: null,
    ...overrides,
  }
}

function culture(overrides: Partial<CultureItpInput> = {}): CultureItpInput {
  return {
    id: 1,
    especeId: "Tomate",
    annee: 2026,
    semisFait: false,
    plantationFaite: false,
    recolteFaite: false,
    couleur: "#dc2626",
    especeNom: "Tomate",
    varieteNom: null,
    plancheName: "S1",
    ilot: "A",
    itp: itp({ semaineRecolte: 33 }),
    ...overrides,
  }
}

describe("semaineCourante", () => {
  it("calcule la semaine ISO 33 du 11 août 2026 (lundi → dimanche)", () => {
    const s = semaineCourante(REFERENCE)
    expect(s.annee).toBe(2026)
    expect(s.semaine).toBe(33)
    expect(s.debutIso).toBe("2026-08-10")
    expect(s.finIso).toBe("2026-08-16")
  })

  it("garde les mêmes bornes du lundi au dimanche", () => {
    const lundi = semaineCourante(new Date(2026, 7, 10))
    const dimanche = semaineCourante(new Date(2026, 7, 16))
    const mardi = semaineCourante(REFERENCE)
    expect(lundi).toEqual(dimanche)
    expect(lundi).toEqual(mardi)
  })

  it("bascule en semaine 34 le lundi suivant", () => {
    const s = semaineCourante(new Date(2026, 7, 17))
    expect(s.semaine).toBe(34)
    expect(s.debutIso).toBe("2026-08-17")
    expect(s.finIso).toBe("2026-08-23")
  })

  // Convention ISO stricte (getISOWeek/getISOWeekYear), la seule utilisée par le
  // référentiel Gleba : la semaine 1 est celle du premier jeudi de janvier, pas
  // celle qui contient le 1er janvier. Le 1er janvier 2027 tombe un vendredi —
  // c'est exactement le cas où les deux conventions divergent (cf. QA cmswxqnaz
  // dans src/lib/assistant-helpers.ts). Le couple (annee, semaine) doit rester
  // cohérent, sinon la clé anti-redondance `tache-itp-semaine:AAAA-Sww` désigne
  // une autre semaine de l'année.
  it("gère le chevauchement de fin d'année (31 déc. 2026 = semaine 53 de 2026)", () => {
    const s = semaineCourante(new Date(2026, 11, 31))
    expect(s.semaine).toBe(53)
    expect(s.annee).toBe(2026)
    expect(s.debutIso).toBe("2026-12-28")
    expect(s.finIso).toBe("2027-01-03")
  })

  it("gère la bascule d'année ISO (4 janv. 2027 = semaine 1 de 2027)", () => {
    const s = semaineCourante(new Date(2027, 0, 4))
    expect(s.semaine).toBe(1)
    expect(s.annee).toBe(2027)
    expect(s.debutIso).toBe("2027-01-04")
  })
})

describe("operationsItp", () => {
  it("positionne le semis sur le lundi de sa semaine ISO", () => {
    const ops = operationsItp(itp({ semaineSemis: 33 }), { anneeCulture: 2026 })
    expect(ops).toHaveLength(1)
    expect(ops[0].type).toBe("semis")
    expect(ops[0].debut).toEqual(new Date(2026, 7, 10))
  })

  it("rejette la plantation postérieure au semis sur l'année suivante", () => {
    // Semis S31 (début août), plantation S3 → l'année suivante (janvier).
    // Le lundi de la S3 de 2027 est le 18/01 ; l'attendu précédent (11/01, la
    // S2) entérinait le décalage d'une semaine après 2026 et ses 53 semaines.
    const ops = operationsItp(itp({ semaineSemis: 31, semainePlantation: 3 }), {
      anneeCulture: 2026,
    })
    const plantation = ops.find((o) => o.type === "plantation")
    expect(plantation?.debut).toEqual(new Date(2027, 0, 18))
  })

  it("étale la récolte sur la fenêtre [début, fin]", () => {
    const ops = operationsItp(itp({ semaineRecolte: 33, semaineRecolteFin: 35 }), {
      anneeCulture: 2026,
    })
    const recolte = ops.find((o) => o.type === "recolte")
    expect(recolte?.debut).toEqual(new Date(2026, 7, 10))
    expect(recolte?.fin).toEqual(new Date(2026, 7, 30)) // dimanche S35
  })

  it("utilise dureeRecolte comme repli de la fenêtre", () => {
    const ops = operationsItp(itp({ semaineRecolte: 33, dureeRecolte: 3 }), {
      anneeCulture: 2026,
    })
    const recolte = ops.find((o) => o.type === "recolte")
    expect(recolte?.fin).toEqual(new Date(2026, 7, 30))
  })

  it("applique le décalage de zone aux semaines", () => {
    const ops = operationsItp(itp({ semaineRecolte: 35 }), {
      anneeCulture: 2026,
      decalageZone: -2, // méditerranéen : 2 semaines plus précoce
    })
    const recolte = ops.find((o) => o.type === "recolte")
    expect(recolte?.debut).toEqual(new Date(2026, 7, 10)) // S33
  })
})

// Revue 2026-11-11, point 23 : les opérations de la semaine suivent désormais
// la même cascade que la création d'une culture (`datesDepuisItp`).
describe("operationsItp — même cascade que les dates d'une culture", () => {
  it("ancre un ITP sans semis ni plantation sur sa fenêtre d'implantation", () => {
    // Mesclun : implantation S40, récolte S5. La récolte était posée en S5 de
    // l'année de la culture, huit mois AVANT l'implantation.
    const ops = operationsItp(itp({ semaineImplantationDebut: 40, semaineRecolte: 5 }), {
      anneeCulture: 2027,
    })
    const semis = ops.find((o) => o.type === "semis")
    const recolte = ops.find((o) => o.type === "recolte")
    expect(semis?.debut).toEqual(new Date(2027, 9, 4)) // lundi S40/2027
    expect(recolte?.debut).toEqual(new Date(2028, 0, 31)) // lundi S5/2028
  })

  it("attend le délai de première récolte d'une pérenne", () => {
    // Asperge : plantée S12, première récolte S16 deux ans plus tard — et non la
    // semaine suivant la plantation.
    const ops = operationsItp(
      itp({ semainePlantation: 12, semaineRecolte: 16, delaiPremiereRecolteAnnees: 2 }),
      { anneeCulture: 2026 }
    )
    expect(ops.find((o) => o.type === "recolte")?.debut).toEqual(new Date(2028, 3, 17))
  })

  it("déduit ce délai de la durée de culture quand il n'est pas déclaré", () => {
    const ops = operationsItp(itp({ semainePlantation: 25, semaineRecolte: 26, dureeCulture: 1095 }), {
      anneeCulture: 2026,
    })
    expect(ops.find((o) => o.type === "recolte")?.debut).toEqual(new Date(2029, 5, 25))
  })

  it("reporte sur la bonne semaine après une année ISO à 53 semaines", () => {
    // 2026 compte 53 semaines : « S5 + 52 » tombait en S4 de 2027.
    const ops = operationsItp(itp({ semaineSemis: 40, semainePlantation: 5, semaineRecolte: 20 }), {
      anneeCulture: 2026,
    })
    expect(ops.find((o) => o.type === "plantation")?.debut).toEqual(new Date(2027, 1, 1)) // lundi S5/2027
    expect(ops.find((o) => o.type === "recolte")?.debut).toEqual(new Date(2027, 4, 17)) // lundi S20/2027
  })
})

describe("resumeTachesItpSemaine", () => {
  const tache = (overrides: Partial<Parameters<typeof resumeTachesItpSemaine>[0][number]> = {}) => ({
    cultureId: 1,
    type: "semis" as const,
    especeNom: "Radis",
    varieteNom: null,
    plancheName: "A1",
    ilot: null,
    date: "2026-08-10",
    semaine: 33,
    couleur: null,
    ...overrides,
  })

  it("ne cite qu'une fois la même espèce sur la même planche", () => {
    // Trois séries de radis sur la planche A1 : « Radis (planche A1) » trois fois.
    const resume = resumeTachesItpSemaine([
      tache({ cultureId: 1 }),
      tache({ cultureId: 2 }),
      tache({ cultureId: 3 }),
      tache({ cultureId: 4, plancheName: "B2" }),
      tache({ cultureId: 5, type: "recolte", especeNom: "Tomate", plancheName: null }),
    ])
    expect(resume).toBe("Semer Radis (planche A1), Radis (planche B2) ; Récolter Tomate")
  })

  it("résume au-delà de douze libellés distincts", () => {
    const taches = Array.from({ length: 14 }, (_, i) => tache({ cultureId: i, especeNom: `Espèce ${i}` }))
    expect(resumeTachesItpSemaine(taches)).toMatch(/… et 2 autres$/)
  })
})

describe("operationsItpDansSemaine", () => {
  const cible = semaineCourante(REFERENCE) // S33 2026

  it("retient l'opération dont la semaine tombe dans la fenêtre cible", () => {
    const ops = operationsItpDansSemaine(itp({ semaineSemis: 33 }), cible, { anneeCulture: 2026 })
    expect(ops).toHaveLength(1)
    expect(ops[0].type).toBe("semis")
    expect(ops[0].date).toBe("2026-08-10")
  })

  it("exclut les opérations hors fenêtre (semaine précédente et suivante)", () => {
    const avant = operationsItpDansSemaine(itp({ semaineSemis: 32 }), cible, { anneeCulture: 2026 })
    const apres = operationsItpDansSemaine(itp({ semaineSemis: 34 }), cible, { anneeCulture: 2026 })
    expect(avant).toHaveLength(0)
    expect(apres).toHaveLength(0)
  })

  it("retient la récolte dont la fenêtre couvre la semaine cible", () => {
    // Fenêtre S32→S34 : la semaine 33 est dedans.
    const ops = operationsItpDansSemaine(
      itp({ semaineRecolte: 32, semaineRecolteFin: 34 }),
      cible,
      { anneeCulture: 2026 }
    )
    expect(ops).toHaveLength(1)
    expect(ops[0].type).toBe("recolte")
  })

  it("exclut une fenêtre de récolte qui ne touche pas la semaine cible", () => {
    const avant = operationsItpDansSemaine(
      itp({ semaineRecolte: 29, semaineRecolteFin: 31 }),
      cible,
      { anneeCulture: 2026 }
    )
    const apres = operationsItpDansSemaine(
      itp({ semaineRecolte: 35, semaineRecolteFin: 37 }),
      cible,
      { anneeCulture: 2026 }
    )
    expect(avant).toHaveLength(0)
    expect(apres).toHaveLength(0)
  })

  it("retient une récolte d'hiver reportée sur l'année suivante", () => {
    // Semis S31 (2026), récolte S4 → semaine 4 de 2027, soit le lundi 25/01
    // (le 18/01 attendu auparavant est la S3 : même décalage qu'au-dessus).
    const cibleHiver = semaineCourante(new Date(2027, 0, 25))
    expect(cibleHiver.semaine).toBe(4)
    const ops = operationsItpDansSemaine(itp({ semaineSemis: 31, semaineRecolte: 4 }), cibleHiver, {
      anneeCulture: 2026,
    })
    expect(ops).toHaveLength(1)
    expect(ops[0].type).toBe("recolte")
    expect(ops[0].date).toBe("2027-01-25")
  })
})

describe("tachesItpSemainePourCultures", () => {
  it("génère une tâche pour une culture active dont l'ITP a une opération cette semaine", () => {
    const taches = tachesItpSemainePourCultures([culture()], { aujourdHui: REFERENCE })
    expect(taches).toHaveLength(1)
    expect(taches[0]).toMatchObject({
      cultureId: 1,
      type: "recolte",
      especeNom: "Tomate",
      varieteNom: null,
      plancheName: "S1",
      ilot: "A",
      date: "2026-08-10",
      semaine: 33,
      couleur: "#dc2626",
    })
  })

  it("ignore les cultures sans ITP", () => {
    const taches = tachesItpSemainePourCultures([culture({ itp: null })], {
      aujourdHui: REFERENCE,
    })
    expect(taches).toHaveLength(0)
  })

  it("éteint chaque opération déjà faite (semisFait → plus de semis)", () => {
    const taches = tachesItpSemainePourCultures(
      [
        culture({
          id: 1,
          itp: itp({ semaineSemis: 33, semainePlantation: 33 }),
          semisFait: true,
          plantationFaite: false,
        }),
      ],
      { aujourdHui: REFERENCE }
    )
    expect(taches).toHaveLength(1)
    expect(taches[0].type).toBe("plantation")
  })

  it("n'éteint pas une opération d'un autre type", () => {
    const taches = tachesItpSemainePourCultures(
      [culture({ itp: itp({ semaineSemis: 33, semaineRecolte: 33 }), recolteFaite: false })],
      { aujourdHui: REFERENCE }
    )
    expect(taches.map((t) => t.type).sort()).toEqual(["recolte", "semis"])
  })

  it("applique le décalage de la zone de l'utilisateur", () => {
    // ITP de référence (zoneClimat null, calé océanique altéré) : récolte S35.
    // Utilisateur méditerranéen (-2 semaines) → récolte effective S33.
    const taches = tachesItpSemainePourCultures(
      [culture({ itp: itp({ semaineRecolte: 35 }) })],
      { userZone: "mediterraneen", aujourdHui: REFERENCE }
    )
    expect(taches).toHaveLength(1)
    expect(taches[0].type).toBe("recolte")
  })

  it("exclut les ITP métropolitains hors de la métropole (zone tropicale)", () => {
    const taches = tachesItpSemainePourCultures(
      [culture({ itp: itp({ semaineRecolte: 33 }) })],
      { userZone: "tropical_antilles", aujourdHui: REFERENCE }
    )
    expect(taches).toHaveLength(0)
  })

  it("ancre une culture sans année sur l'année de la semaine cible", () => {
    const taches = tachesItpSemainePourCultures(
      [culture({ annee: null, itp: itp({ semaineSemis: 33 }) })],
      { aujourdHui: REFERENCE }
    )
    expect(taches).toHaveLength(1)
    expect(taches[0].date).toBe("2026-08-10")
  })

  it("trie par date puis par type (semis, plantation, récolte)", () => {
    const taches = tachesItpSemainePourCultures(
      [
        culture({ id: 1, itp: itp({ semaineRecolte: 33 }) }),
        culture({ id: 2, itp: itp({ semaineSemis: 33, semainePlantation: 33 }) }),
      ],
      { aujourdHui: REFERENCE }
    )
    expect(taches.map((t) => t.type)).toEqual(["semis", "plantation", "recolte"])
  })

  it("ne génère rien quand aucune opération ne tombe cette semaine", () => {
    const taches = tachesItpSemainePourCultures(
      [
        culture({ itp: itp({ semaineSemis: 30 }) }),
        culture({ id: 2, itp: itp({ semaineRecolte: 36 }) }),
      ],
      { aujourdHui: REFERENCE }
    )
    expect(taches).toHaveLength(0)
  })

  it("ne génère rien sans aucune culture", () => {
    expect(tachesItpSemainePourCultures([], { aujourdHui: REFERENCE })).toHaveLength(0)
  })
})

describe("la date saisie fait foi", () => {
  // QA C14 : les notifications se calculaient sur les semaines THÉORIQUES de
  // l'ITP alors que /taches lit les dates stockées. Une courgette semée le 15/04
  // (S16) avec un ITP à S14/S18/S34 recevait « planter » en S18, quand l'écran
  // plaçait la plantation au 20/05 (S21) — et rien n'arrivait en S21.
  const ITP = { id: "Courgette-printemps", zoneClimat: null, semaineSemis: 14, semainePlantation: 18, semaineRecolte: 34 }
  const base = {
    id: 346,
    especeId: "Courgette",
    annee: 2026,
    semisFait: true,
    plantationFaite: false,
    recolteFaite: false,
    couleur: null,
    especeNom: "Courgette",
    varieteNom: null,
    plancheName: "B2",
    ilot: null,
    itp: ITP,
  }

  it("ne réclame pas la plantation à la semaine théorique quand une date est saisie", () => {
    const taches = tachesItpSemainePourCultures(
      [{ ...base, datePlantation: new Date("2026-05-20T00:00:00Z") }],
      { aujourdHui: new Date("2026-04-29T12:00:00Z") } // S18
    )
    expect(taches.filter((t) => t.type === "plantation")).toHaveLength(0)
  })

  it("la réclame à la semaine de la date saisie", () => {
    const taches = tachesItpSemainePourCultures(
      [{ ...base, datePlantation: new Date("2026-05-20T00:00:00Z") }],
      { aujourdHui: new Date("2026-05-20T12:00:00Z") } // S21
    )
    expect(taches.filter((t) => t.type === "plantation")).toHaveLength(1)
    expect(taches[0].date).toBe("2026-05-20")
  })

  it("garde la semaine de l'ITP pour un jalon NON daté", () => {
    const taches = tachesItpSemainePourCultures(
      [{ ...base, plantationFaite: true, dateRecolte: null }],
      { aujourdHui: new Date("2026-08-19T12:00:00Z") } // S34
    )
    expect(taches.filter((t) => t.type === "recolte")).toHaveLength(1)
  })

  it("ne produit jamais deux tâches pour le même jalon", () => {
    const taches = tachesItpSemainePourCultures(
      [{ ...base, datePlantation: new Date("2026-04-27T00:00:00Z") }], // S18, comme l'ITP
      { aujourdHui: new Date("2026-04-29T12:00:00Z") }
    )
    expect(taches.filter((t) => t.type === "plantation")).toHaveLength(1)
  })
})
