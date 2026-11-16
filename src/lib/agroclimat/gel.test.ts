import { describe, expect, it } from "vitest"
import { CASES_ANNEE, caseDuJour, caseInexistante, isoDeLaCase, jourDeLaCase, rangDansAnnee } from "./calendrier"
import { frequenceGelDepuis, frequenceGelJusqua, gelParAnnee, statistiquesGel, type AnneeTmin } from "./gel"

/**
 * Année douce (5 °C partout), avec du gel de janvier jusqu'à `derniere` et de
 * `premiere` à fin décembre. `null` = pas de gel de ce côté.
 */
function annee(
  an: number,
  derniere: [number, number] | null,
  premiere: [number, number] | null,
  temperatureGel = -1
): AnneeTmin {
  const tmin: (number | null)[] = new Array(CASES_ANNEE).fill(5)
  if (derniere) for (let i = 0; i <= caseDuJour(...derniere); i += 7) tmin[i] = temperatureGel
  if (derniere) tmin[caseDuJour(...derniere)] = temperatureGel
  if (premiere) for (let i = caseDuJour(...premiere); i < CASES_ANNEE; i += 7) tmin[i] = temperatureGel
  if (caseInexistante(an, 59)) tmin[59] = null
  return { annee: an, tmin }
}

describe("calendrier à 366 cases", () => {
  it("range la même date dans la même case, année bissextile ou non", () => {
    expect(caseDuJour(1, 1)).toBe(0)
    expect(caseDuJour(2, 29)).toBe(59)
    expect(caseDuJour(5, 1)).toBe(121)
    expect(caseDuJour(12, 31)).toBe(365)
    expect(jourDeLaCase(121)).toEqual({ mois: 5, jour: 1 })
    expect(jourDeLaCase(0)).toEqual({ mois: 1, jour: 1 })
    expect(jourDeLaCase(365)).toEqual({ mois: 12, jour: 31 })
    expect(isoDeLaCase(2025, 121)).toBe("2025-05-01")
  })

  it("connaît le 29 février qui n'existe pas", () => {
    expect(caseInexistante(2025, 59)).toBe(true)
    expect(caseInexistante(2024, 59)).toBe(false)
    expect(caseInexistante(2025, 60)).toBe(false)
  })

  it("rend le rang réel du jour dans l'année", () => {
    expect(rangDansAnnee(2024, caseDuJour(3, 1))).toBe(61)
    expect(rangDansAnnee(2025, caseDuJour(3, 1))).toBe(60)
    expect(rangDansAnnee(2025, caseDuJour(1, 1))).toBe(1)
    expect(rangDansAnnee(2025, caseDuJour(12, 31))).toBe(365)
  })
})

describe("gel par année", () => {
  it("relève la dernière gelée de printemps et la première d'automne", () => {
    const [a] = gelParAnnee([annee(2020, [4, 12], [11, 3])])
    expect(a.derniereGelee).toBe(caseDuJour(4, 12))
    expect(a.premiereGelee).toBe(caseDuJour(11, 3))
    expect(a.joursDeGel).toBeGreaterThan(10)
  })

  it("distingue une année sans gel d'une année sans données", () => {
    const sansGel = gelParAnnee([annee(2021, null, null)])[0]
    expect(sansGel.derniereGelee).toBeNull()
    expect(sansGel.premiereGelee).toBeNull()
    expect(sansGel.joursDeGel).toBe(0)

    const trouee = annee(2022, [4, 1], [11, 1])
    const tmin = [...trouee.tmin]
    for (let i = caseDuJour(3, 1); i < caseDuJour(3, 20); i++) tmin[i] = null
    const incomplet = gelParAnnee([{ annee: 2022, tmin }])[0]
    expect(incomplet.derniereGelee).toBeUndefined()
    expect(incomplet.premiereGelee).toBe(caseDuJour(11, 1))
    expect(incomplet.joursDeGel).toBeUndefined()
  })

  it("ne compte pas le 29 février absent comme un trou", () => {
    const a = annee(2023, [3, 20], [11, 10])
    expect(a.tmin[59]).toBeNull()
    expect(gelParAnnee([a])[0].derniereGelee).toBe(caseDuJour(3, 20))
  })

  it("applique le seuil demandé", () => {
    const a = annee(2020, [4, 12], [11, 3], -1)
    expect(gelParAnnee([a], -2)[0].derniereGelee).toBeNull()
    expect(gelParAnnee([a], 0)[0].derniereGelee).toBe(caseDuJour(4, 12))
  })

  it("laisse en suspens l'automne d'une année en cours", () => {
    const a = annee(2026, [4, 2], null)
    const tmin = [...a.tmin]
    for (let i = caseDuJour(9, 15); i < CASES_ANNEE; i++) tmin[i] = null
    const enCours = gelParAnnee([{ annee: 2026, tmin }])[0]
    expect(enCours.derniereGelee).toBe(caseDuJour(4, 2))
    expect(enCours.premiereGelee).toBeUndefined()
  })
})

describe("statistiques de gel", () => {
  // Dix années : dernière gelée du 1er au 10 avril, première du 1er au 10 novembre.
  const dixAns = Array.from({ length: 10 }, (_, k) => annee(2010 + k, [4, k + 1], [11, k + 1]))

  it("situe la date médiane et la date de prudence", () => {
    const s = statistiquesGel(dixAns)
    expect(s.periode).toEqual({ debut: 2010, fin: 2019 })
    expect(s.printemps.annees).toBe(10)
    expect(s.printemps.mediane).toBe(caseDuJour(4, 5))
    // Une année sur dix au plus gèle après le 9 avril (seule 2019, le 10).
    expect(s.printemps.prudence).toBe(caseDuJour(4, 9))
    expect(s.printemps.extreme).toEqual({ annee: 2019, case: caseDuJour(4, 10) })
    expect(s.automne.mediane).toBe(caseDuJour(11, 5))
    expect(s.automne.prudence).toBe(caseDuJour(11, 1))
    expect(s.automne.extreme).toEqual({ annee: 2010, case: caseDuJour(11, 1) })
  })

  it("mesure la saison sans gel", () => {
    // Du 6 avril au 4 novembre pour l'année médiane : 213 jours.
    expect(statistiquesGel(dixAns).saisonSansGelJours).toBe(213)
  })

  it("range les années sans gel du bon côté", () => {
    const s = statistiquesGel([
      ...Array.from({ length: 6 }, (_, k) => annee(2000 + k, null, null)),
      ...Array.from({ length: 4 }, (_, k) => annee(2006 + k, [3, 10 + k], [12, 1 + k])),
    ])
    expect(s.printemps.anneesSansGel).toBe(6)
    // Une année sur deux ne gèle pas : pas de date médiane.
    expect(s.printemps.mediane).toBeNull()
    expect(s.printemps.prudence).toBe(caseDuJour(3, 12))
    expect(s.automne.mediane).toBeNull()
    expect(s.automne.prudence).toBe(caseDuJour(12, 1))
    expect(s.saisonSansGelJours).not.toBeNull()
  })

  it("ne garde que les trente dernières années", () => {
    const s = statistiquesGel(Array.from({ length: 36 }, (_, k) => annee(1990 + k, [4, 1], [11, 1])))
    expect(s.printemps.annees).toBe(30)
    expect(s.periode).toEqual({ debut: 1996, fin: 2025 })
  })

  it("compare la moitié récente à la moitié ancienne", () => {
    const s = statistiquesGel([
      ...Array.from({ length: 10 }, (_, k) => annee(2000 + k, [4, 20], [11, 1])),
      ...Array.from({ length: 10 }, (_, k) => annee(2010 + k, [4, 8], [11, 1])),
    ])
    expect(s.tendancePrintemps).toEqual({ ecartJours: -12, anneesRecentes: 10, anneesAnciennes: 10 })
    expect(statistiquesGel(dixAns).tendancePrintemps).toBeNull()
  })

  it("rend un résultat vide sans données", () => {
    const s = statistiquesGel([])
    expect(s.periode).toBeNull()
    expect(s.printemps).toEqual({ annees: 0, anneesSansGel: 0, mediane: null, prudence: null, extreme: null })
    expect(s.joursDeGelParAn).toBeNull()
    expect(s.saisonSansGelJours).toBeNull()
  })
})

describe("fréquence du gel autour d'une date", () => {
  const dixAns = Array.from({ length: 10 }, (_, k) => annee(2010 + k, [4, k + 1], [11, k + 1]))

  it("compte les années où il a gelé à la date ou après", () => {
    expect(frequenceGelDepuis(dixAns, caseDuJour(4, 8))).toEqual({ annees: 10, anneesAvecGel: 3 })
    expect(frequenceGelDepuis(dixAns, caseDuJour(4, 11))).toEqual({ annees: 10, anneesAvecGel: 0 })
    expect(frequenceGelDepuis(dixAns, caseDuJour(3, 1))).toEqual({ annees: 10, anneesAvecGel: 10 })
  })

  it("compte les années où il a gelé à la date ou avant", () => {
    expect(frequenceGelJusqua(dixAns, caseDuJour(11, 3))).toEqual({ annees: 10, anneesAvecGel: 3 })
    expect(frequenceGelJusqua(dixAns, caseDuJour(10, 31))).toEqual({ annees: 10, anneesAvecGel: 0 })
  })
})
