import { describe, it, expect } from "vitest"
import { croissanceCulture, envergureArbreADate } from "../plan-croissance"

describe("plan-croissance", () => {
  describe("croissanceCulture", () => {
    const culture = {
      dateSemis: "2026-04-01",
      datePlantation: "2026-05-01",
      dateRecolte: "2026-07-30", // 90 jours après plantation
      finRecolte: "2026-09-15",
      itp: { dureeCulture: 90, dureeRecolte: 6 },
    }

    it("absente avant la mise en place", () => {
      expect(croissanceCulture(culture, new Date("2026-04-15"))).toBeNull()
    })

    it("petite juste après plantation, à mi-taille à mi-parcours, adulte à la récolte", () => {
      expect(croissanceCulture(culture, new Date("2026-05-02"))!).toBeLessThan(0.15)
      const mi = croissanceCulture(culture, new Date("2026-06-15"))!
      expect(mi).toBeGreaterThan(0.4)
      expect(mi).toBeLessThan(0.6)
      expect(croissanceCulture(culture, new Date("2026-08-10"))).toBe(1)
    })

    it("libère la planche après la fin de récolte", () => {
      expect(croissanceCulture(culture, new Date("2026-10-01"))).toBeNull()
    })

    it("repli sur la durée ITP sans dateRecolte, et fin par défaut", () => {
      const sansRecolte = { ...culture, dateRecolte: null, finRecolte: null }
      // Maturité = plantation + 90 j = fin juillet
      expect(croissanceCulture(sansRecolte, new Date("2026-08-05"))).toBe(1)
      // Fin = maturité + 6 semaines → mi-septembre encore en place, novembre libérée
      expect(croissanceCulture(sansRecolte, new Date("2026-09-05"))).toBe(1)
      expect(croissanceCulture(sansRecolte, new Date("2026-11-01"))).toBeNull()
    })

    it("vivace : reste en place après la fenêtre de récolte, et d'une année sur l'autre", () => {
      // Cas réel du 2026-08-25 : fraisiers plantés en 2023, récolte 05/05/2026,
      // fin de récolte inconnue → disparus du plan dès la mi-juin.
      const fraisier = {
        dateSemis: null,
        datePlantation: "2023-04-03",
        dateRecolte: "2026-05-05",
        finRecolte: null,
        itp: { dureeCulture: null, dureeRecolte: null },
        espece: { vivace: true },
      }
      expect(croissanceCulture(fraisier, new Date("2026-08-25"))).toBe(1)
      // Une fenêtre de récolte explicite ne la retire pas non plus
      expect(
        croissanceCulture({ ...fraisier, finRecolte: "2026-09-08" }, new Date("2026-12-01"))
      ).toBe(1)
      // Toujours là l'année suivante
      expect(croissanceCulture(fraisier, new Date("2027-06-01"))).toBe(1)
      // Mais absente avant sa plantation, et jeune juste après
      expect(croissanceCulture(fraisier, new Date("2023-01-01"))).toBeNull()
      expect(croissanceCulture(fraisier, new Date("2023-04-10"))!).toBeLessThan(0.2)
    })

    it("annuelle : la même culture sans le drapeau vivace libère bien la planche", () => {
      const annuelle = {
        dateSemis: null,
        datePlantation: "2026-04-03",
        dateRecolte: "2026-05-05",
        finRecolte: null,
        itp: { dureeCulture: null, dureeRecolte: null },
        espece: { vivace: false },
      }
      expect(croissanceCulture(annuelle, new Date("2026-08-25"))).toBeNull()
    })

    it("sans aucune date : présente à taille adulte (import)", () => {
      expect(
        croissanceCulture(
          { dateSemis: null, datePlantation: null, dateRecolte: null, finRecolte: null },
          new Date("2026-01-01")
        )
      ).toBe(1)
    })
  })

  describe("envergureArbreADate", () => {
    const aujourdHui = new Date("2026-07-20")
    const arbre = {
      envergure: 2,
      envergureAdulte: 6,
      datePlantation: "2021-07-20", // 5 ans → 5 ans de croissance restants
    }

    it("aujourd'hui : l'envergure mesurée", () => {
      expect(envergureArbreADate(arbre, aujourdHui, aujourdHui)).toBe(2)
    })

    it("dans le futur : croît vers la couronne adulte puis plafonne", () => {
      const dans2ans = envergureArbreADate(arbre, new Date("2028-07-20"), aujourdHui)
      expect(dans2ans).toBeGreaterThan(3)
      expect(dans2ans).toBeLessThan(5)
      expect(envergureArbreADate(arbre, new Date("2040-01-01"), aujourdHui)).toBe(6)
    })

    it("dans le passé : plus petit, et absent avant la plantation", () => {
      const passe = envergureArbreADate(arbre, new Date("2023-07-20"), aujourdHui)
      expect(passe).toBeGreaterThan(0.6)
      expect(passe).toBeLessThan(2)
      expect(envergureArbreADate(arbre, new Date("2020-01-01"), aujourdHui)).toBe(0)
    })

    it("sans envergure adulte connue : reste à l'envergure actuelle", () => {
      expect(
        envergureArbreADate({ envergure: 3 }, new Date("2030-01-01"), aujourdHui)
      ).toBe(3)
    })
  })
})
