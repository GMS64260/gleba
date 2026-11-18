/**
 * Revue du 2026-11-11 : filtres, pastille d'urgence et année de la page
 * Irriguer (`/maraichage/cultures/irriguer`).
 */
import { describe, expect, it } from "vitest"
import {
  anneeDemandee,
  etiquetteUrgence,
  filtrerCultures,
  niveauBesoinEau,
  optionsTypeIrrigation,
  phraseSansBilan,
  TYPE_IRRIGATION_NON_DEFINI,
} from "../page-irriguer"

const culture = (
  id: number,
  irrigation: string | null,
  besoinEau: number | null = 3,
  extra: Partial<{ urgence: string; joursSansEau: number | null; irrigationEspece: string | null; sansPlanche: boolean }> = {},
) => ({
  id,
  urgence: extra.urgence ?? "moyenne",
  joursSansEau: extra.joursSansEau === undefined ? 2 : extra.joursSansEau,
  planche: extra.sansPlanche ? null : { irrigation },
  espece: { besoinEau, irrigation: extra.irrigationEspece ?? null },
})

const TOUS = { urgence: "all", typeIrrigation: "all", besoinEau: "all" } as const

describe("filtre par système d'arrosage", () => {
  const cultures = [
    culture(1, "Goutte-a-goutte"),
    culture(2, "Goutte-à-goutte"),
    culture(3, "Aspersion"),
    culture(4, null),
    culture(5, null, 3, { sansPlanche: true }),
  ]

  it("une seule option par système, libellé accentué, « Non défini » en dernier", () => {
    expect(optionsTypeIrrigation(cultures)).toEqual([
      { valeur: "Aspersion", libelle: "Aspersion", nombre: 1 },
      { valeur: "Goutte-à-goutte", libelle: "Goutte-à-goutte", nombre: 2 },
      { valeur: TYPE_IRRIGATION_NON_DEFINI, libelle: "Non défini", nombre: 2 },
    ])
  })

  it("chaque option retrouve le nombre de cultures qu'elle annonce", () => {
    for (const option of optionsTypeIrrigation(cultures)) {
      expect(filtrerCultures(cultures, { ...TOUS, typeIrrigation: option.valeur }), option.libelle).toHaveLength(option.nombre)
    }
    expect(filtrerCultures(cultures, { ...TOUS, typeIrrigation: TYPE_IRRIGATION_NON_DEFINI }).map((c) => c.id)).toEqual([4, 5])
  })
})

describe("filtre par besoin en eau", () => {
  const cultures = [
    culture(1, null, 2),
    culture(2, null, 3),
    culture(3, null, 4),
    culture(4, null, 5),
    culture(5, null, 2, { irrigationEspece: "Eleve" }),
  ]

  it("« Moyen (3) » ne garde pas les besoins élevés", () => {
    expect(filtrerCultures(cultures, { ...TOUS, besoinEau: "3" }).map((c) => c.id)).toEqual([2])
  })

  it("« Élevé » suit la pastille de la ligne, espèce classée « Eleve » comprise", () => {
    expect(filtrerCultures(cultures, { ...TOUS, besoinEau: "4" }).map((c) => c.id)).toEqual([3, 4, 5])
    expect(niveauBesoinEau(2, "Eleve")).toBe("eleve")
    expect(niveauBesoinEau(3, null)).toBe("moyen")
    expect(niveauBesoinEau(null, null)).toBe("faible")
  })
})

describe("filtre par urgence", () => {
  const cultures = [
    culture(1, null, 3, { urgence: "critique" }),
    culture(2, null, 3, { urgence: "haute", joursSansEau: null }),
    culture(3, null, 3, { urgence: "aucune" }),
  ]

  it("une urgence, ou les cultures jamais arrosées", () => {
    expect(filtrerCultures(cultures, { ...TOUS, urgence: "critique" }).map((c) => c.id)).toEqual([1])
    expect(filtrerCultures(cultures, { ...TOUS, urgence: "jamais" }).map((c) => c.id)).toEqual([2])
    expect(filtrerCultures(cultures, TOUS)).toHaveLength(3)
  })
})

describe("pastille d'urgence", () => {
  it("une culture de la tournée jamais notée reste « Priorité », pas « Jamais »", () => {
    expect(etiquetteUrgence("haute", true)).toBe("priorite")
    expect(etiquetteUrgence("critique", true)).toBe("urgent")
  })

  it("« Jamais » ne remplace que les urgences sans tâche", () => {
    expect(etiquetteUrgence("moyenne", true)).toBe("jamais")
    expect(etiquetteUrgence("faible", true)).toBe("jamais")
    expect(etiquetteUrgence("aucune", true)).toBe("ok")
    expect(etiquetteUrgence("moyenne", false)).toBe("moyen")
    expect(etiquetteUrgence("faible", false)).toBe("faible")
  })
})

describe("année de la page", () => {
  const maintenant = new Date(2026, 10, 11)

  it("année illisible dans l'adresse : la saison en cours", () => {
    for (const valeur of [null, "", "abc", "2026abc", "NaN", "99999", "-5"]) {
      expect(anneeDemandee(valeur, maintenant), String(valeur)).toBe(2026)
    }
  })

  it("année lisible : gardée", () => {
    expect(anneeDemandee("2025", maintenant)).toBe(2025)
  })
})

describe("cultures sans bilan hydrique", () => {
  it("dit combien de cultures n'ont pas été calculées, rien sinon", () => {
    expect(phraseSansBilan(0)).toBeNull()
    expect(phraseSansBilan(undefined)).toBeNull()
    expect(phraseSansBilan(1)).toBe("1 culture sans bilan hydrique")
    expect(phraseSansBilan(4)).toBe("4 cultures sans bilan hydrique")
  })
})
