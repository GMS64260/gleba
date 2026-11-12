/**
 * Conseiller d'irrigation sans météo (revue du 2026-10-28) : le bandeau dit la
 * panne, et une ligne sans bilan n'affiche ni « Bilan 7 j » ni « j sans pluie ».
 */
import { describe, expect, it } from "vitest"
import { afficheMesuresMeteo, bandeauMeteoIndisponible, etatNappeIndisponible, phraseNappeIndisponible } from "../meteo-indisponible"

describe("conseiller d'irrigation sans météo", () => {
  it("pas de bandeau quand toutes les zones ont leur météo", () => {
    expect(bandeauMeteoIndisponible({ indisponible: false, zonesIndisponibles: 0, culturesSansMeteo: 0 })).toBeNull()
    // Réponse d'avant la revue (champs absents) : rien à dire.
    expect(bandeauMeteoIndisponible({})).toBeNull()
    // Cultures sans parcelle géolocalisée : chaque ligne le dit déjà.
    expect(bandeauMeteoIndisponible({ indisponible: false, zonesIndisponibles: 0, culturesSansMeteo: 2 })).toBeNull()
  })

  it("panne totale : aucun bilan, les cultures restent listées", () => {
    expect(bandeauMeteoIndisponible({ indisponible: true, zonesIndisponibles: 2, culturesSansMeteo: 5 })).toBe(
      "Météo momentanément indisponible : aucun bilan hydrique calculé. Les cultures restent listées, sans dose ; conseil à revoir plus tard.",
    )
  })

  it("panne partielle : le nombre de zones touchées", () => {
    expect(bandeauMeteoIndisponible({ indisponible: false, zonesIndisponibles: 1, culturesSansMeteo: 1 })).toBe(
      "Météo momentanément indisponible pour 1 zone : ses cultures sont listées sans bilan hydrique ni dose ; conseil à revoir plus tard.",
    )
    expect(bandeauMeteoIndisponible({ indisponible: false, zonesIndisponibles: 3 })).toMatch(/^Météo momentanément indisponible pour 3 zones : leurs cultures/)
  })

  it("une ligne sans météo n'affiche pas de mesures (bilan 7 j, jours sans pluie)", () => {
    expect(afficheMesuresMeteo({ sansMeteo: null })).toBe(true)
    expect(afficheMesuresMeteo({})).toBe(true)
    expect(afficheMesuresMeteo({ sansMeteo: "meteo-indisponible" })).toBe(false)
    expect(afficheMesuresMeteo({ sansMeteo: "sans-coordonnees" })).toBe(false)
  })
})

/**
 * Revue du 2026-11-11 : le bloc nappe ne traitait que 404 et 503 ; tout autre
 * échec le faisait disparaître sans un mot, et le message annonçait 50 km
 * pour une recherche à 100 km.
 */
describe("nappe indisponible", () => {
  it("404 : aucune station récente dans le rayon réellement cherché", () => {
    expect(etatNappeIndisponible(404)).toBe("aucune-station")
    expect(phraseNappeIndisponible("aucune-station")).toBe(
      "Nappe : aucune station Hub'Eau avec des relevés récents dans un rayon de 100 km.",
    )
  })

  it("tout autre échec, réseau compris, est une panne dite comme telle", () => {
    for (const statut of [500, 502, 503, 400, 429, null]) {
      expect(etatNappeIndisponible(statut), String(statut)).toBe("panne")
    }
    expect(phraseNappeIndisponible("panne")).toMatch(/momentanément indisponible/)
  })
})
