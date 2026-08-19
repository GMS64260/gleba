import { describe, expect, it } from "vitest"
import {
  borneLectureIrrigation,
  estPerimee,
  frequenceIrrigationJours,
  idsAExpirer,
  joursDeRetard,
} from "@/lib/irrigation-peremption"

/** 29 juillet 2026, midi local — aucune bascule de jour possible. */
const REFERENCE = new Date(2026, 6, 29, 12, 0, 0)

function jourLocal(annee: number, mois: number, jour: number): Date {
  return new Date(annee, mois, jour, 8, 0, 0)
}

describe("frequenceIrrigationJours", () => {
  it("dérive la cadence du besoin en eau, comme le planificateur", () => {
    expect(frequenceIrrigationJours(5)).toBe(2)
    expect(frequenceIrrigationJours(4)).toBe(2)
    expect(frequenceIrrigationJours(3)).toBe(3)
    expect(frequenceIrrigationJours(2)).toBe(5)
    expect(frequenceIrrigationJours(1)).toBe(5)
  })

  it("retombe sur le défaut du planificateur quand l'espèce ne dit rien", () => {
    // 16 espèces du référentiel n'ont pas de besoinEau : elles ne doivent pas
    // périmer plus vite que les autres faute de donnée.
    expect(frequenceIrrigationJours(null)).toBe(3)
    expect(frequenceIrrigationJours(undefined)).toBe(3)
  })
})

describe("joursDeRetard", () => {
  it("compte des journées civiles locales, pas des tranches de 24 h", () => {
    // Le conteneur tourne en Europe/Paris : comparer des instants ferait
    // basculer d'un jour juste après minuit.
    expect(joursDeRetard(jourLocal(2026, 6, 29), REFERENCE)).toBe(0)
    expect(joursDeRetard(jourLocal(2026, 6, 28), REFERENCE)).toBe(1)
    expect(joursDeRetard(new Date(2026, 6, 28, 23, 59), REFERENCE)).toBe(1)
    expect(joursDeRetard(new Date(2026, 6, 29, 0, 1), REFERENCE)).toBe(0)
  })

  it("reste négatif pour une échéance à venir", () => {
    expect(joursDeRetard(jourLocal(2026, 6, 31), REFERENCE)).toBe(-2)
  })
})

describe("estPerimee", () => {
  it("laisse rattrapable un passage manqué d'au plus un cycle", () => {
    // Gourmande, cycle 2 j : hier et avant-hier restent rattrapables.
    expect(estPerimee(jourLocal(2026, 6, 29), 4, REFERENCE)).toBe(false)
    expect(estPerimee(jourLocal(2026, 6, 28), 4, REFERENCE)).toBe(false)
    expect(estPerimee(jourLocal(2026, 6, 27), 4, REFERENCE)).toBe(false)
  })

  it("abandonne au-delà d'un cycle complet", () => {
    expect(estPerimee(jourLocal(2026, 6, 26), 4, REFERENCE)).toBe(true)
    expect(estPerimee(jourLocal(2026, 6, 20), 4, REFERENCE)).toBe(true)
  })

  it("étire la tolérance pour une espèce peu exigeante", () => {
    // Cycle 5 j : le 24 tient encore, le 23 non.
    expect(estPerimee(jourLocal(2026, 6, 24), 1, REFERENCE)).toBe(false)
    expect(estPerimee(jourLocal(2026, 6, 23), 1, REFERENCE)).toBe(true)
  })

  it("ne périme jamais une échéance future", () => {
    expect(estPerimee(jourLocal(2026, 7, 5), 4, REFERENCE)).toBe(false)
  })
})

describe("borneLectureIrrigation", () => {
  // Régression du 2026-08-14 : le briefing plafonne sa lecture à 101 lignes
  // triées par date croissante. Sans borne, un compte à 1 018 passages
  // abandonnés ne chargeait que du périmé et annonçait « 0 irrigation » alors
  // que 10 passages étaient réellement dus.
  it("recule d'un cycle maximum sous le jour courant", () => {
    const borne = borneLectureIrrigation(REFERENCE, new Date(2020, 0, 1))
    expect(borne.getFullYear()).toBe(2026)
    expect(borne.getMonth()).toBe(6)
    expect(borne.getDate()).toBe(24) // 29 juillet - 5 jours
  })

  it("ne franchit jamais le plancher du compte", () => {
    // Compte créé avant-hier : ne pas remonter avant son inscription.
    const inscription = jourLocal(2026, 6, 27)
    expect(borneLectureIrrigation(REFERENCE, inscription)).toBe(inscription)
  })

  it("couvre tout passage encore rattrapable, cycle le plus long compris", () => {
    const borne = borneLectureIrrigation(REFERENCE, new Date(2020, 0, 1))
    // Une espèce peu exigeante (cycle 5 j) manquée le 24 tient encore : elle
    // doit rester dans la fenêtre de lecture.
    const passage = jourLocal(2026, 6, 24)
    expect(estPerimee(passage, 1, REFERENCE)).toBe(false)
    expect(passage.getTime()).toBeGreaterThanOrEqual(borne.getTime())
  })
})

describe("idsAExpirer", () => {
  const gourmande = { espece: { besoinEau: 4 } }

  it("ne retient que les passages encore dus et réellement périmés", () => {
    const ids = idsAExpirer(
      [
        // Périmé : 9 jours de retard, jamais fait.
        { id: 1, datePrevue: jourLocal(2026, 6, 20), fait: false, perimee: false, culture: gourmande },
        // Déjà fait : un arrosage réalisé ne s'abandonne pas.
        { id: 2, datePrevue: jourLocal(2026, 6, 20), fait: true, perimee: false, culture: gourmande },
        // Déjà abandonné : ne pas le réécrire à chaque lecture.
        { id: 3, datePrevue: jourLocal(2026, 6, 20), fait: false, perimee: true, culture: gourmande },
        // Encore rattrapable.
        { id: 4, datePrevue: jourLocal(2026, 6, 28), fait: false, perimee: false, culture: gourmande },
      ],
      REFERENCE,
    )

    expect(ids).toEqual([1])
  })

  it("tolère une culture ou une espèce absente sans planter", () => {
    const ids = idsAExpirer(
      [
        { id: 1, datePrevue: jourLocal(2026, 6, 20), fait: false, perimee: false, culture: null },
        { id: 2, datePrevue: jourLocal(2026, 6, 20), fait: false, perimee: false, culture: { espece: null } },
      ],
      REFERENCE,
    )

    // Cadence par défaut (3 j) : neuf jours de retard restent périmés.
    expect(ids).toEqual([1, 2])
  })

  it("ne renvoie rien sur un plan à jour", () => {
    expect(idsAExpirer([], REFERENCE)).toEqual([])
  })
})
