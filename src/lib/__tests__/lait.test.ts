import { describe, it, expect } from "vitest"
import {
  isoWeek,
  dim,
  courbeLactation,
  tauxPonteSaisonnalise,
  COEF_PONTE_MOIS,
  categorieCellules,
  statutCellules,
  analyseQualiteLait,
  SEUILS_CELLULES,
  synthetiseLactations,
} from "../lait"

describe("lait", () => {
  describe("isoWeek", () => {
    it("retourne la semaine ISO d'une date connue", () => {
      // 6 janvier 2026 (mardi) = semaine 2 de 2026
      const r = isoWeek(new Date("2026-01-06"))
      expect(r.year).toBe(2026)
      expect(r.week).toBe(2)
    })

    it("traite correctement le 1er janvier qui appartient à l'année précédente", () => {
      // 1er janvier 2027 (vendredi) = semaine 53 de 2026 (selon ISO 8601)
      const r = isoWeek(new Date("2027-01-01"))
      expect(r.year).toBe(2026)
      expect(r.week).toBe(53)
    })
  })

  describe("dim", () => {
    it("calcule les jours depuis la mise-bas", () => {
      const naissance = new Date("2026-01-01")
      const observation = new Date("2026-01-31") // 30 jours après
      expect(dim(naissance, observation)).toBe(30)
    })
  })

  describe("courbeLactation", () => {
    it("agrège les collectes par jour et calcule la moyenne 7j", () => {
      const dateMb = new Date("2026-01-01")
      const collectes = [
        { date: new Date("2026-01-02"), quantiteLitres: 2.5 },
        { date: new Date("2026-01-02"), quantiteLitres: 2.0 }, // matin + soir
        { date: new Date("2026-01-03"), quantiteLitres: 5.0 },
      ]
      const courbe = courbeLactation(collectes, dateMb)
      expect(courbe.length).toBeGreaterThan(0)
      // J0 (date origine) volume 0, J1 volume 4.5
      const j1 = courbe.find((c) => c.dim === 1)
      expect(j1?.volume).toBeCloseTo(4.5, 1)
    })
  })

  describe("tauxPonteSaisonnalise", () => {
    it("calcule le taux observé", () => {
      // 10 pondeuses × 30 jours × 0,8 œuf/jour = 240 œufs
      const start = new Date("2026-04-01")
      const end = new Date("2026-05-01")
      const r = tauxPonteSaisonnalise(240, 10, start, end)
      expect(r.tauxObserve).toBeGreaterThan(70)
      expect(r.tauxObserve).toBeLessThan(85)
    })

    it("retourne 0 si pas de pondeuses", () => {
      const r = tauxPonteSaisonnalise(100, 0, new Date("2026-01-01"), new Date("2026-01-31"))
      expect(r.tauxObserve).toBe(0)
    })

    it("coefs ponte couvrent 12 mois avec moyenne ~1", () => {
      const somme = Object.values(COEF_PONTE_MOIS).reduce((a, b) => a + b, 0)
      expect(somme / 12).toBeGreaterThan(0.9)
      expect(somme / 12).toBeLessThan(1.1)
    })
  })

  // PROMPT 20 — cellules & qualité du lait
  describe("categorieCellules", () => {
    it("détecte la filière depuis la catégorie réglementaire", () => {
      expect(categorieCellules("Caprin")).toBe("caprin")
      expect(categorieCellules("Ovin lait")).toBe("ovin")
      expect(categorieCellules("Bovin")).toBe("bovin")
      expect(categorieCellules(null)).toBe("default")
      expect(categorieCellules("Volaille de ponte")).toBe("default")
    })
  })

  describe("statutCellules", () => {
    it("est plus tolérant en caprin qu'en bovin", () => {
      // 900 k/mL : normal pour une chèvre, alerte pour une vache
      expect(statutCellules(900, "caprin")).toBe("ok")
      expect(statutCellules(900, "bovin")).toBe("alerte")
    })
    it("classe surveillance / alerte selon les seuils caprins", () => {
      const s = SEUILS_CELLULES.caprin
      expect(statutCellules(s.surveillance - 1, "caprin")).toBe("ok")
      expect(statutCellules(s.surveillance, "caprin")).toBe("surveillance")
      expect(statutCellules(s.alerte, "caprin")).toBe("alerte")
    })
    it("retourne ok si pas de valeur", () => {
      expect(statutCellules(null, "caprin")).toBe("ok")
    })
  })

  describe("analyseQualiteLait", () => {
    it("retourne un état vide sans mesure", () => {
      const r = analyseQualiteLait([], "caprin")
      expect(r.derniere).toBeNull()
      expect(r.nbMesures).toBe(0)
      expect(r.statut).toBe("ok")
    })

    it("prend la mesure la plus récente comme dernière et classe le statut", () => {
      const r = analyseQualiteLait(
        [
          { date: "2026-03-01", cellules: 700, mg: 38, mp: 31 },
          { date: "2026-04-01", cellules: 1600, mg: 40, mp: 32 }, // plus récente
        ],
        "caprin"
      )
      expect(r.derniere?.cellules).toBe(1600)
      expect(r.statut).toBe("alerte")
      expect(r.nbMesures).toBe(2)
      expect(r.moyenneCellules).toBe(1150)
    })

    it("détecte une tendance à la hausse (dernière vs moyenne des précédentes)", () => {
      const r = analyseQualiteLait(
        [
          { date: "2026-01-01", cellules: 500 },
          { date: "2026-02-01", cellules: 520 },
          { date: "2026-03-01", cellules: 900 },
        ],
        "caprin"
      )
      expect(r.tendance).toBe("hausse")
    })

    it("détecte une tendance stable dans la marge ±15 %", () => {
      const r = analyseQualiteLait(
        [
          { date: "2026-01-01", cellules: 500 },
          { date: "2026-02-01", cellules: 520 },
        ],
        "caprin"
      )
      expect(r.tendance).toBe("stable")
    })

    it("ignore les mesures sans numération pour la tendance mais moyenne TB/TP", () => {
      const r = analyseQualiteLait(
        [
          { date: "2026-01-01", cellules: null, mg: 36, mp: 30 },
          { date: "2026-02-01", cellules: 800, mg: 40, mp: 32 },
        ],
        "caprin"
      )
      expect(r.nbMesures).toBe(1)
      expect(r.moyenneMg).toBe(38)
      expect(r.moyenneMp).toBe(31)
    })
  })

  // PROMPT 21 — synthèse par lactation
  describe("synthetiseLactations", () => {
    const ref = new Date("2026-06-01")

    it("retourne [] sans mise-bas ni collecte", () => {
      expect(synthetiseLactations([], [], ref)).toEqual([])
    })

    it("crée deux lactations avec le bon rang et referme à la mise-bas suivante", () => {
      const miseBas = [{ date: "2025-01-15" }, { date: "2026-01-20" }]
      const collectes = [
        // lactation 1
        { date: "2025-02-01", quantiteLitres: 3 },
        { date: "2025-06-01", quantiteLitres: 2.5 },
        // après la 2e mise-bas
        { date: "2026-02-01", quantiteLitres: 3.5 },
      ]
      const lacts = synthetiseLactations(miseBas, collectes, ref)
      expect(lacts.length).toBe(2)
      expect(lacts[0].rang).toBe(1)
      expect(lacts[1].rang).toBe(2)
      // La collecte de 2026-02-01 appartient à la lactation 2, pas à la 1
      expect(lacts[0].nbTraites).toBe(2)
      expect(lacts[1].nbTraites).toBe(1)
      // La 1re est close (mise-bas suivante), la 2e en cours
      expect(lacts[0].enCours).toBe(false)
      expect(lacts[1].enCours).toBe(true)
      expect(lacts[0].fin).toBe("2026-01-20")
    })

    it("plafonne le lait 305 j aux 305 premiers jours", () => {
      const miseBas = [{ date: "2025-01-01" }]
      const collectes = [
        { date: "2025-02-01", quantiteLitres: 3 }, // dans les 305 j
        { date: "2025-12-15", quantiteLitres: 2 }, // au-delà de 305 j (jour ~348)
      ]
      const lacts = synthetiseLactations(miseBas, collectes, ref)
      expect(lacts.length).toBe(1)
      expect(lacts[0].laitTotal).toBe(5)
      expect(lacts[0].lait305).toBe(3) // la collecte hors 305 j est exclue
    })

    it("repli sans mise-bas : lactation de rang inconnu depuis la 1re collecte", () => {
      const collectes = [
        { date: "2026-03-01", quantiteLitres: 3 },
        { date: "2026-03-02", quantiteLitres: 3.2 },
      ]
      const lacts = synthetiseLactations([], collectes, ref)
      expect(lacts.length).toBe(1)
      expect(lacts[0].rang).toBeNull()
      expect(lacts[0].enCours).toBe(true)
    })

    it("calcule un pic de lactation cohérent", () => {
      const miseBas = [{ date: "2026-05-01" }]
      const collectes = [
        { date: "2026-05-10", quantiteLitres: 4 },
        { date: "2026-05-11", quantiteLitres: 4 },
      ]
      const lacts = synthetiseLactations(miseBas, collectes, ref)
      expect(lacts[0].pic).toBeGreaterThan(0)
      expect(lacts[0].pic).toBeLessThanOrEqual(4)
    })
  })
})
