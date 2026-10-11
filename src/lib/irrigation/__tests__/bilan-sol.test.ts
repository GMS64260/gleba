/**
 * Moteur de bilan hydrique du sol (itération du 2026-10-10) : scénarios
 * agronomiques de référence.
 */
import { describe, expect, it } from "vitest"
import {
  bilanReserveSol,
  dureeCycleJours,
  eauDisponibleSol,
  kcAuStade,
  profilEspece,
  pluieUtile,
  phraseVolume,
  racinesAuStade,
  volumeArrosage,
  type EntreeBilanSol,
  type JourMeteoBilan,
} from "../bilan-sol"

const AUJOURDHUI = "2026-07-20"

function jours(n: number, fin: string, valeur: (i: number) => { pluie: number; et0: number }): JourMeteoBilan[] {
  const t = Date.parse(`${fin}T12:00:00`)
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(t - (n - 1 - i) * 86_400_000)
    return { date: d.toISOString().slice(0, 10), ...valeur(i) }
  })
}
function apres(n: number, valeur: (i: number) => { pluie: number; et0: number }): JourMeteoBilan[] {
  const t = Date.parse(`${AUJOURDHUI}T12:00:00`)
  return Array.from({ length: n }, (_, i) => ({
    date: new Date(t + (i + 1) * 86_400_000).toISOString().slice(0, 10),
    ...valeur(i),
  }))
}

function entree(o: Partial<EntreeBilanSol> & { et0?: number } = {}): EntreeBilanSol {
  const et0 = o.et0 ?? 5
  return {
    historique: o.historique ?? jours(30, "2026-07-19", () => ({ pluie: 0, et0 })),
    aujourdhui: o.aujourdhui ?? { date: AUJOURDHUI, pluie: 0, et0 },
    previsions: o.previsions ?? apres(7, () => ({ pluie: 0, et0 })),
    joursArroses: o.joursArroses ?? [],
    apports: o.apports,
    sol: o.sol ?? { typeSol: "Limoneux", retentionEau: null },
    culture: {
      espece: "Tomate",
      besoinEau: 5,
      debut: "2026-05-15",
      dureeCycleJours: 140,
      sousAbri: false,
      ...(o.culture ?? {}),
    },
  }
}

const RANG = { critique: 0, haute: 1, moyenne: 2, faible: 3, aucune: 4 } as const

describe("bilanReserveSol", () => {
  it("canicule sans pluie ni arrosage depuis 30 jours : critique, une réserve facile à apporter", () => {
    const r = bilanReserveSol(entree())
    expect(r.urgence).toBe("critique")
    expect(r.joursAvantSeuil).toBe(0)
    expect(r.doseMm).toBeGreaterThan(30)
    expect(r.raison).toMatch(/^À arroser/)
    expect(r.raison).toMatch(/Aucun arrosage noté : le bilan ne compte que la pluie\.$/)
  })

  it("arrosé hier : rien à faire aujourd'hui, seuil dans quelques jours", () => {
    const r = bilanReserveSol(entree({ joursArroses: ["2026-07-19"] }))
    expect(["aucune", "faible"]).toContain(r.urgence)
    // Seuil au-delà de l'horizon (null) ou dans plusieurs jours.
    expect(r.joursAvantSeuil === null || r.joursAvantSeuil > 1).toBe(true)
    expect(r.dernierApport).toEqual({ type: "arrosage", date: "2026-07-19", mm: null })
  })

  it("forte pluie avant-hier sur un sol régulièrement arrosé par la pluie : réserve rechargée", () => {
    // 15 mm un jour sur deux : la pluie couvre la consommation d'une tomate en pleine saison.
    const historique = jours(30, "2026-07-19", (i) => ({ pluie: i === 28 ? 40 : i % 2 === 0 ? 15 : 0, et0: 5 }))
    const r = bilanReserveSol(entree({ historique }))
    expect(RANG[r.urgence]).toBeGreaterThanOrEqual(RANG.faible)
    expect(r.dernierApport).toEqual({ type: "pluie", date: "2026-07-18", mm: 40 })
  })

  it("après un mois de canicule, une seule pluie de 40 mm ne remplit pas une réserve profonde", () => {
    const historique = jours(30, "2026-07-19", (i) => ({ pluie: i === 28 ? 40 : 0, et0: 5 }))
    const r = bilanReserveSol(entree({ historique }))
    // 34 mm utiles pour une réserve de plus de 100 mm presque vide.
    expect(r.reserveUtileMm).toBeGreaterThan(100)
    expect(RANG[r.urgence]).toBeLessThanOrEqual(RANG.haute)
  })

  it("libellés : réserve dépassée sans pourcentage absurde, réserve entamée jamais dite « bien pourvue »", () => {
    const sec = bilanReserveSol(entree())
    expect(sec.raison).toMatch(/réserve facile épuisée \(\d+ mm consommés pour \d+ mm, réserve totale \d+ mm\)/)
    expect(sec.raison).not.toMatch(/%/)
    const entame = bilanReserveSol(entree({ joursArroses: ["2026-07-13"], previsions: apres(7, () => ({ pluie: 0, et0: 0.5 })) }))
    expect(entame.urgence).toBe("moyenne")
    expect(entame.raison).not.toMatch(/bien pourvu/)
  })

  // Ticket QA cmv2rdmdn : 312 L saisis en intervention étaient ignorés.
  it("un arrosage de volume connu compte pour ce qu'il apporte", () => {
    const sec = bilanReserveSol(entree({ joursArroses: ["2026-07-13"] }))
    expect(sec.urgence).toBe("moyenne")
    // Exactement la dose conseillée, arrivée au sol aujourd'hui : réserve remplie.
    const plein = bilanReserveSol(entree({ joursArroses: ["2026-07-13"], apports: [{ date: AUJOURDHUI, mm: sec.doseMm }] }))
    expect(plein.depletionMm).toBe(0)
    expect(plein.urgence).toBe("aucune")
    expect(plein.dernierApport).toEqual({ type: "arrosage", date: AUJOURDHUI, mm: sec.doseMm })
    expect(plein.raison).toMatch(/dernier arrosage le 20\/07 \([0-9,]+ mm au sol\)/)
    // Un apport partiel ne retranche que son eau.
    const partiel = bilanReserveSol(entree({ joursArroses: ["2026-07-13"], apports: [{ date: AUJOURDHUI, mm: 10 }] }))
    expect(sec.depletionMm - partiel.depletionMm).toBeCloseTo(10, 0)
    // Un apport saisi fait taire « Aucun arrosage noté ».
    const sansNote = bilanReserveSol(entree({ apports: [{ date: "2026-07-01", mm: 5 }] }))
    expect(sansNote.raison).not.toMatch(/Aucun arrosage noté/)
  })

  // Ticket QA cmv2re9vl : le sol de la parcelle n'était pas lu.
  it("sans sol de planche, le sol de la parcelle compte, quelle que soit son écriture", () => {
    const sol = (s: Partial<EntreeBilanSol["sol"]>) => ({ typeSol: null, retentionEau: null, ...s })
    expect(eauDisponibleSol(sol({ typeSolParcelle: "sableux" }))).toBe(80)
    expect(eauDisponibleSol(sol({ typeSolParcelle: "limono-argileux" }))).toBe(160)
    expect(eauDisponibleSol(sol({ typeSolParcelle: "calcaire" }))).toBe(120)
    expect(eauDisponibleSol(sol({ typeSol: "Argileux", typeSolParcelle: "sableux" }))).toBe(150)
    expect(eauDisponibleSol(sol({ retentionEau: "Élevée", typeSolParcelle: "sableux" }))).toBe(160)
    const sable = bilanReserveSol(entree({ joursArroses: ["2026-07-15"], sol: sol({ typeSolParcelle: "sableux" }) }))
    const limon = bilanReserveSol(entree({ joursArroses: ["2026-07-15"], sol: sol({ typeSolParcelle: "limoneux" }) }))
    expect(sable.reserveUtileMm).toBeLessThan(limon.reserveUtileMm)
    expect(sable.tauxEpuisement).toBeGreaterThan(limon.tauxEpuisement)
    expect(sable.solRenseigne).toBe(true)
  })

  // Ticket QA cmv3jaru7 : sol de planche absent, sol de parcelle utilisé en silence.
  it("sol de la parcelle : la réserve est dite estimée, avec le sol retenu", () => {
    const r = bilanReserveSol(entree({ sol: { typeSol: null, retentionEau: null, typeSolParcelle: "limono-sableux" } }))
    expect(r.solSource).toBe("parcelle")
    expect(r.raison).toMatch(/Sol de la planche non renseigné : réserve estimée d'après le sol de la parcelle \(limono-sableux\)\.$/)
    expect(bilanReserveSol(entree()).solSource).toBe("planche")
    expect(bilanReserveSol(entree({ sol: { typeSol: null, retentionEau: "Faible" } })).solSource).toBe("planche")
    expect(bilanReserveSol(entree({ sol: { typeSol: null, retentionEau: null } })).solSource).toBe("defaut")
    expect(bilanReserveSol(entree()).raison).not.toMatch(/estimée/)
  })

  // Revue du lot cmv3japsf : verser la dose conseillée peut laisser « à arroser ».
  it("une réserve trop entamée pour une seule dose : le conseil annonce le second apport", () => {
    const r = bilanReserveSol(entree({ et0: 6 }))
    expect(r.urgence).toBe("critique")
    expect(r.depletionMm - r.doseMm).toBeGreaterThanOrEqual(0.75 * r.reserveFacileMm)
    expect(r.raison).toMatch(
      /Un apport ne suffit pas : après cette dose, il manquera encore [0-9,]+ mm\. Notez la quantité versée pour que le conseil demande le complément\./,
    )
    const leger = bilanReserveSol(entree({ joursArroses: ["2026-07-13"] }))
    expect(leger.raison).not.toMatch(/Un apport ne suffit pas/)
  })

  // Ticket QA cmv3ja7nr : « le bilan ne compte que la pluie » sous un tunnel.
  it("sous abri sans arrosage noté, le motif ne parle pas de pluie", () => {
    const abri = bilanReserveSol(entree({ culture: { sousAbri: true } as never }))
    expect(abri.raison).toMatch(/Aucun arrosage noté : le bilan ne compte aucun apport d'eau\./)
    expect(abri.raison).not.toMatch(/ne compte que la pluie/)
    expect(bilanReserveSol(entree()).raison).toMatch(/ne compte que la pluie/)
  })

  it("sol inconnu partout : réserve d'un sol moyen, et le motif le dit", () => {
    const r = bilanReserveSol(entree({ sol: { typeSol: null, retentionEau: null, typeSolParcelle: null } }))
    expect(r.solRenseigne).toBe(false)
    expect(r.raison).toMatch(/Sol non renseigné \(planche et parcelle\)/)
    expect(bilanReserveSol(entree()).raison).not.toMatch(/Sol non renseigné/)
  })

  it("une bruine de 2 mm n'apporte rien", () => {
    expect(pluieUtile(2)).toBe(0)
    expect(pluieUtile(12)).toBeCloseTo(9)
  })

  it("une pluie annoncée ne change rien à une culture seulement « à surveiller »", () => {
    // Arrosé il y a 6 jours : réserve facile presque consommée, pas dépassée.
    const base = entree({ joursArroses: ["2026-07-14"] })
    const sansPluie = bilanReserveSol(base)
    const avecPluie = bilanReserveSol({ ...base, previsions: apres(7, (i) => ({ pluie: i === 0 ? 30 : 0, et0: 5 })) })
    expect(sansPluie.urgence).toBe("moyenne")
    expect(avecPluie.urgence).toBe("moyenne")
  })

  it("une pluie annoncée qui remplit la réserve dispense d'arroser une réserve entamée", () => {
    // Arrosé il y a 8 jours : réserve facile dépassée.
    const base = entree({ joursArroses: ["2026-07-12"] })
    const sansPluie = bilanReserveSol(base)
    const avecPluie = bilanReserveSol({ ...base, previsions: apres(7, (i) => ({ pluie: i === 0 ? 30 : 0, et0: 5 })) })
    expect(RANG[avecPluie.urgence]).toBeGreaterThan(RANG[sansPluie.urgence])
    expect(avecPluie.raison).toMatch(/pluie prévus/)
  })

  it("un sol sableux s'épuise plus vite qu'un sol argileux", () => {
    const parSol = (typeSol: string) => bilanReserveSol(entree({ joursArroses: ["2026-07-15"], sol: { typeSol, retentionEau: null } }))
    expect(eauDisponibleSol({ typeSol: "Sableux", retentionEau: null })).toBeLessThan(eauDisponibleSol({ typeSol: "Argileux", retentionEau: null }))
    expect(parSol("Sableux").tauxEpuisement).toBeGreaterThan(parSol("Argileux").tauxEpuisement)
  })

  it("une espèce gourmande (besoin 5) n'est jamais moins urgente qu'une sobre (besoin 1)", () => {
    for (const et0 of [0.6, 1.5, 3, 5]) {
      const r = (besoinEau: number) =>
        bilanReserveSol(entree({ et0, joursArroses: ["2026-07-12"], culture: { espece: "Espèce inconnue", besoinEau } as never }))
      expect(r(5).tauxEpuisement).toBeGreaterThanOrEqual(r(1).tauxEpuisement)
      expect(RANG[r(5).urgence]).toBeLessThanOrEqual(RANG[r(1).urgence])
    }
  })

  it("hiver (ET0 0,6 mm/j, pluie hebdomadaire) : rien à arroser", () => {
    const historique = jours(30, "2026-07-19", (i) => ({ pluie: i % 7 === 0 ? 8 : 0, et0: 0.6 }))
    const r = bilanReserveSol(entree({ et0: 0.6, historique, culture: { espece: "Poireau", besoinEau: 3 } as never }))
    expect(RANG[r.urgence]).toBeGreaterThanOrEqual(RANG.faible)
  })

  it("sous abri, la pluie ne compte pas et l'ET est réduite", () => {
    const pluvieux = jours(30, "2026-07-19", () => ({ pluie: 10, et0: 4 }))
    const dehors = bilanReserveSol(entree({ et0: 4, historique: pluvieux }))
    const abri = bilanReserveSol(entree({ et0: 4, historique: pluvieux, culture: { sousAbri: true } as never }))
    expect(dehors.urgence).toBe("aucune")
    expect(RANG[abri.urgence]).toBeLessThanOrEqual(RANG.haute)
    expect(abri.etcJour).toBeCloseTo(dehors.etcJour * 0.8, 1)
    expect(abri.raison).toMatch(/^Sous abri/)
  })

  it("une culture pas encore en terre ne consomme rien", () => {
    const r = bilanReserveSol(entree({ culture: { debut: "2026-07-20" } as never }))
    expect(r.depletionMm).toBeLessThan(5)
  })

  it("les racines d'une jeune culture limitent sa réserve", () => {
    const jeune = bilanReserveSol(entree({ culture: { debut: "2026-07-10" } as never }))
    const adulte = bilanReserveSol(entree({ culture: { debut: "2026-04-15" } as never }))
    expect(jeune.profondeurRacinesM).toBeLessThan(adulte.profondeurRacinesM)
    expect(jeune.reserveUtileMm).toBeLessThan(adulte.reserveUtileMm)
  })

  it("reconnaît une espèce par son premier mot et retombe sur le besoin en eau sinon", () => {
    expect(profilEspece("Tomate cerise", 3).racinesM).toBe(0.7)
    expect(profilEspece("tomate", 3).p).toBe(0.4)
    expect(profilEspece("Inconnue", 5).p).toBeLessThan(profilEspece("Inconnue", 1).p)
  })

  it("noms usuels : accents, pluriels, tirets et alias", () => {
    const tomate = profilEspece("Tomate", 3)
    expect(profilEspece("Tomates", 1)).toBe(tomate)
    expect(profilEspece("TOMATE  cœur de bœuf", 1)).toBe(tomate)
    expect(profilEspece("Epinard", 1)).toBe(profilEspece("Épinard", 1))
    expect(profilEspece("pomme-de-terre", 1)).toBe(profilEspece("Pomme de terre", 1))
    expect(profilEspece("Petit pois", 1)).toBe(profilEspece("Pois", 1))
    expect(profilEspece("Petits pois", 1)).toBe(profilEspece("Pois", 1))
    expect(profilEspece("Laitue batavia", 1)).toBe(profilEspece("Salade", 1))
    expect(profilEspece("Mâche", 1)).toBe(profilEspece("Salade", 1))
    expect(profilEspece("Potimarron", 1)).toBe(profilEspece("Courge", 1))
    expect(profilEspece("Choux de Bruxelles", 1)).toBe(profilEspece("Chou", 1))
    expect(profilEspece("Chou-fleur", 1)).toBe(profilEspece("Chou", 1))
    expect(profilEspece("Radis", 1)).toBe(profilEspece("radis noir", 5))
    expect(profilEspece("Fraisiers", 1)).toBe(profilEspece("Fraise", 1))
    expect(profilEspece("Céleri-rave", 1).racinesM).toBe(0.3)
    expect(profilEspece("Maïs doux", 1).racinesM).toBe(0.8)
    expect(profilEspece("Pomme de terre primeur", 1)).toBe(profilEspece("Pomme de terre", 1))
  })

  it("Kc en quatre phases : plateau de pleine saison", () => {
    const tomate = profilEspece("Tomate", 3)
    expect(kcAuStade(tomate, 0.05)).toBe(0.6)
    expect(kcAuStade(tomate, 0.3)).toBeGreaterThan(0.6)
    expect(kcAuStade(tomate, 0.3)).toBeLessThan(1.15)
    expect(kcAuStade(tomate, 0.5)).toBe(1.15)
    expect(kcAuStade(tomate, 0.75)).toBe(1.15)
    expect(kcAuStade(tomate, 1)).toBeCloseTo(0.8)
    expect(racinesAuStade(tomate, 0.45)).toBeCloseTo(0.7)
  })

  it("durée du cycle : la date de récolte seule est un début de récolte", () => {
    expect(dureeCycleJours("2026-05-01", "2026-07-01", "2026-09-01")).toBe(123)
    expect(dureeCycleJours("2026-05-01", "2026-07-01", null)).toBe(91)
    expect(dureeCycleJours("2026-05-01", null, null)).toBeNull()
    expect(dureeCycleJours(null, "2026-07-01", null)).toBeNull()
  })

  it("25 mm annoncés demain dispensent d'arroser une réserve facile tout juste consommée", () => {
    // Arrosé il y a 8 jours : réserve facile juste consommée, pas encore critique.
    const base = entree({ joursArroses: ["2026-07-12"] })
    expect(bilanReserveSol(base).urgence).toBe("haute")
    const pluie = (mm: number) => bilanReserveSol({ ...base, previsions: apres(7, (i) => ({ pluie: i === 0 ? mm : 0, et0: 5 })) })
    // Dans 48 h, la réserve est revenue sous le seuil : inutile d'arroser la veille.
    expect(pluie(25).urgence).toBe("moyenne")
    expect(pluie(25).doseMm).toBe(0)
    expect(pluie(25).raison).toMatch(/^25 mm de pluie prévus/)
    // 8 mm ne compensent pas deux jours de consommation : il faut arroser.
    expect(pluie(8).urgence).toBe("haute")
  })

  it("la dose d'un arrosage est l'épuisement, au plus la réserve facile", () => {
    const r = bilanReserveSol(entree())
    expect(r.depletionMm).toBeGreaterThan(r.reserveFacileMm)
    expect(r.doseMm).toBeCloseTo(r.reserveFacileMm, 0)
    const juste = bilanReserveSol(entree({ joursArroses: ["2026-07-13"] }))
    expect(juste.urgence).toBe("moyenne")
    expect(juste.doseMm).toBeCloseTo(juste.depletionMm, 0)
  })

  it("la projection ne compte pas la consommation avant la plantation", () => {
    const r = bilanReserveSol(entree({ culture: { debut: "2026-07-25" } as never }))
    expect(r.depletionMm).toBe(0)
    expect(r.joursAvantSeuil).toBeNull()
  })

  it("le volume hebdomadaire suit le besoin potentiel, pas la consommation réduite par le stress", () => {
    const r = bilanReserveSol(entree())
    expect(r.etcPotentielleMoyenne7j).toBeGreaterThan(r.etcMoyenne7j)
  })

  it("vivace installée en dormance (décembre) : Kc de départ de végétation", () => {
    const decembre = (j: number) => `2026-12-${String(j).padStart(2, "0")}`
    const r = bilanReserveSol({
      ...entree({ culture: { espece: "Groseillier", debut: "2022-03-01", dureeCycleJours: null, vivace: true } as never }),
      historique: [1, 2, 3, 4, 5].map((j) => ({ date: decembre(j), pluie: 0, et0: 0.5 })),
      aujourdhui: { date: decembre(6), pluie: 0, et0: 0.5 },
      previsions: [],
    })
    expect(r.kc).toBeCloseTo(0.3)
  })

  it("vivace installée : Kc de pleine saison en juillet, racines en place", () => {
    const groseillier = bilanReserveSol(
      entree({ culture: { espece: "Groseillier", debut: "2022-03-01", dureeCycleJours: null, vivace: true } as never }),
    )
    expect(groseillier.kc).toBeCloseTo(1.05)
    expect(groseillier.profondeurRacinesM).toBe(0.6)
    // Même vivace l'année de sa plantation : jeune, racines courtes.
    const jeune = bilanReserveSol(
      entree({ culture: { espece: "Groseillier", debut: "2026-06-20", dureeCycleJours: null, vivace: true } as never }),
    )
    expect(jeune.profondeurRacinesM).toBeLessThan(0.6)
  })

  it("volume selon le système d'arrosage, en passages d'au plus 20 L/m² versés", () => {
    expect(volumeArrosage(18, 10, "Goutte-à-goutte")).toEqual({ litresParM2: 20, litres: 200, passages: 1 })
    expect(volumeArrosage(15, 10, "Aspersion")).toEqual({ litresParM2: 20, litres: 200, passages: 1 })
    expect(volumeArrosage(16, 10, null)).toEqual({ litresParM2: 20, litres: 200, passages: 1 })
    expect(volumeArrosage(0, 10, null)).toEqual({ litresParM2: 0, litres: 0, passages: 0 })
    // 17 mm au sol en aspersion : 22,7 L/m² versés, donc deux passages.
    expect(volumeArrosage(17, 10, "Aspersion").passages).toBe(2)
    // Une grosse dose au goutte-à-goutte reste un seul passage (apport au pied).
    expect(volumeArrosage(60, 10, "goutte à goutte").passages).toBe(1)
    expect(volumeArrosage(60, 10, "Arrosoir")).toEqual({ litresParM2: 75, litres: 750, passages: 4 })
    expect(volumeArrosage(16.5, 10, null).passages).toBe(1)
  })

  it("phrase de volume : passages et litres seulement s'ils ont un sens", () => {
    expect(phraseVolume(volumeArrosage(60, 10, null), "pour la planche")).toBe(
      "Apport conseillé : 75 L/m², soit 750 L pour la planche, en 4 passages d'environ 19 L/m² espacés de quelques heures.",
    )
    expect(phraseVolume(volumeArrosage(16, 0, null), "pour la planche")).toBe("Apport conseillé : 20 L/m².")
    // Ticket QA cmv3javy4 : nombres à la française ; ordre de grandeur sans sol de planche.
    expect(phraseVolume(volumeArrosage(26.9, 0, "Goutte-a-goutte"), "pour la planche")).toBe("Apport conseillé : 29,9 L/m².")
    expect(phraseVolume(volumeArrosage(45.6, 30, null), "pour la planche", true)).toBe(
      "Apport conseillé : environ 57 L/m², soit 1\u202f710 L pour la planche, en 3 passages d'environ 19 L/m² espacés de quelques heures.",
    )
    expect(phraseVolume(volumeArrosage(0, 10, null), "pour la planche")).toBe("")
  })

  it("une culture pas encore en place n'a aucun besoin hebdomadaire", () => {
    const r = bilanReserveSol(entree({ culture: { debut: "2026-07-25" } as never }))
    expect(r.etcJour).toBe(0)
    expect(r.etcPotentielleMoyenne7j).toBe(0)
    expect(r.raison).toMatch(/^Pas encore sur la planche : mise en place prévue le 25\/07/)
  })

  it("une bruine ou un jour sans ET0 ne relèvent pas le seuil : l'urgence ne baisse que de l'eau reçue", () => {
    // Réserve facile dépassée depuis la veille (tomate, temps chaud), puis un jour frais.
    const base = entree({ joursArroses: ["2026-07-10"] })
    const hier = bilanReserveSol({ ...base, historique: base.historique.slice(0, -1), aujourdhui: base.historique[29] })
    expect(hier.urgence).toBe("haute")
    const bruine = bilanReserveSol({ ...base, aujourdhui: { date: AUJOURDHUI, pluie: 4.5, et0: 1 } })
    const trou = bilanReserveSol({ ...base, aujourdhui: { date: AUJOURDHUI, pluie: 0, et0: 0 } })
    for (const r of [bruine, trou]) {
      expect(r.reserveFacileMm).toBeLessThanOrEqual(hier.reserveFacileMm)
      expect(r.urgence).toBe("haute")
    }
    // La bruine (2,25 mm utiles) moins la journée (1,15 mm) : 1,1 mm de moins, pas davantage.
    expect(hier.depletionMm - bruine.depletionMm).toBeCloseTo(1.1, 0)
    expect(trou.depletionMm).toBeCloseTo(hier.depletionMm, 1)
  })

  it("après une vague de chaleur, la fraîcheur relève progressivement le seuil d'arrosage", () => {
    // 15 jours à 7 mm d'ET0, arrosé le dernier jour chaud, puis 16 jours frais sans pluie.
    const historique = jours(30, "2026-07-19", (i) => ({ pluie: 0, et0: i < 15 ? 7 : 1.5 }))
    const r = bilanReserveSol(entree({ et0: 1.5, historique, joursArroses: ["2026-07-04"] }))
    // p de la tomate à 1,7 mm/j d'ETc : 0,53 ; au plus chaud : 0,28.
    expect(r.reserveFacileMm / r.reserveUtileMm).toBeGreaterThan(0.45)
    expect(r.urgence).toBe("faible")
  })

  // Revue du 2026-10-10 : avec une fenêtre glissante de 30 jours, sans
  // arrosage noté, l'épuisement redevenait chaque jour la somme des 30 derniers
  // jours ; à l'automne il baissait sans une goutte d'eau. L'historique part
  // désormais d'un jour fixe (meteo-bilan.ts) et ne fait que s'allonger.
  describe("automne sans pluie ni arrosage noté, historique ancré : l'urgence ne recule jamais", () => {
    const ANCRE = Date.parse("2026-06-01T12:00:00")
    const iso = (k: number) => new Date(ANCRE + k * 86_400_000).toISOString().slice(0, 10)
    for (const [espece, typeSol] of [["Tomate", "Limoneux"], ["Tomate", "Mixte"], ["Carotte", "Argileux"], ["Salade", "Sableux"]]) {
      it(`${espece}, sol ${typeSol}, ET0 de 5 à 0,8 mm`, () => {
        // ET0 décroissante avec un bruit déterministe de ±40 %.
        const meteo = Array.from({ length: 150 }, (_, k) => ({
          date: iso(k),
          pluie: 0,
          et0: (5 - (4.2 * k) / 150) * (1 + 0.4 * Math.sin(k * 2.3)),
        }))
        let precedent = RANG.aucune
        for (let k = 20; k < 140; k++) {
          const r = bilanReserveSol({
            historique: meteo.slice(0, k),
            aujourdhui: meteo[k],
            previsions: meteo.slice(k + 1, k + 8),
            joursArroses: [],
            sol: { typeSol, retentionEau: null },
            culture: { espece, besoinEau: 3, debut: "2026-05-01", dureeCycleJours: 200, sousAbri: false },
          })
          expect(RANG[r.urgence]).toBeLessThanOrEqual(precedent)
          precedent = RANG[r.urgence]
        }
      })
    }
  })

  describe("stabilité : sans pluie ni arrosage, l'urgence ne recule jamais d'un jour à l'autre", () => {
    const DEBUT = Date.parse("2026-06-01T12:00:00")
    const iso = (k: number) => new Date(DEBUT + k * 86_400_000).toISOString().slice(0, 10)
    function serie(et0: (k: number) => number, espece: string, typeSol: string) {
      const meteo = Array.from({ length: 80 }, (_, k) => ({ date: iso(k), pluie: 0, et0: et0(k) }))
      const rangs: number[] = []
      for (let k = 41; k < 70; k++) {
        const r = bilanReserveSol({
          historique: meteo.slice(k - 30, k),
          aujourdhui: meteo[k],
          previsions: meteo.slice(k + 1, k + 8),
          joursArroses: [iso(40)],
          sol: { typeSol, retentionEau: null },
          culture: { espece, besoinEau: 3, debut: "2026-05-01", dureeCycleJours: 150, sousAbri: false },
        })
        rangs.push(RANG[r.urgence])
      }
      return rangs
    }
    // Générateur pseudo-aléatoire déterministe (LCG).
    function aleatoire(graine: number) {
      let s = graine
      return () => ((s = (s * 1_103_515_245 + 12_345) % 2_147_483_648) / 2_147_483_648)
    }
    const cas: [string, (k: number) => number][] = [
      ["ET0 alternée 2/8 mm", (k) => (k % 2 ? 8 : 2)],
      ["ET0 alternée 1/6 mm", (k) => (k % 2 ? 6 : 1)],
      ...[1, 2, 3, 4, 5].map((g): [string, (k: number) => number] => {
        const r = aleatoire(g)
        const valeurs = Array.from({ length: 80 }, () => 0.5 + r() * 7.5)
        return [`ET0 aléatoire, graine ${g}`, (k) => valeurs[k]]
      }),
    ]
    for (const [nom, et0] of cas) {
      for (const [espece, sol] of [["Tomate", "Limoneux"], ["Salade", "Sableux"], ["Carotte", "Argileux"]]) {
        it(`${nom}, ${espece}, sol ${sol}`, () => {
          const rangs = serie(et0, espece, sol)
          for (let i = 1; i < rangs.length; i++) expect(rangs[i]).toBeLessThanOrEqual(rangs[i - 1])
          expect(rangs[rangs.length - 1]).toBe(RANG.critique)
        })
      }
    }
  })
})
