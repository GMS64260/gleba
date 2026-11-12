import { describe, expect, it } from "vitest"

import {
  datesDepuisItp,
  debutCyclePourRecolte,
  moisDepuisSemaine,
  recolteApresDebut,
  semaineVersDate,
  type SemainesItp,
} from "@/lib/cultures/dates-itp"

const jour = (d: Date | null) =>
  d
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    : null

/**
 * Revue 2026-11-11, point 22. La création d'une culture pose la récolte avec
 * `datesDepuisItp` ; dès qu'on touche à la date de début, le formulaire la
 * recale avec `recolteApresDebut`. Les deux doivent rendre la MÊME récolte
 * quand le début est celui de l'ITP — sinon ouvrir puis enregistrer une culture
 * déplace sa récolte d'une semaine sans raison.
 */
const CAS: Record<string, SemainesItp> = {
  ailAutomne: { semainePlantation: 42, semaineRecolte: 25 },
  semisAutomneRecolteHiver: { semaineSemis: 40, semainePlantation: 5, semaineRecolte: 45 },
  mesclun: { semaineImplantationDebut: 40, semaineRecolte: 5 },
  recolteS1: { semaineSemis: 36, semaineRecolte: 1 },
  semisS52: { semaineSemis: 52, semainePlantation: 6, semaineRecolte: 20 },
  printemps: { semaineSemis: 10, semainePlantation: 16, semaineRecolte: 27 },
  cocotier: { semainePlantation: 46, semaineRecolte: 44, dureeCulture: 2555 },
  avocatier: { semainePlantation: 25, semaineRecolte: 26, dureeCulture: 1095 },
  asperge: { semainePlantation: 12, semaineRecolte: 16, delaiPremiereRecolteAnnees: 2 },
  biennale400: { semaineSemis: 10, semaineRecolte: 30, dureeCulture: 400 },
}

describe("recolteApresDebut — même récolte que datesDepuisItp au début théorique", () => {
  for (const [nom, itp] of Object.entries(CAS)) {
    it(`${nom} : de 2020 à 2033, années à 53 semaines comprises`, () => {
      for (let annee = 2020; annee <= 2033; annee++) {
        const d = datesDepuisItp(annee, itp)
        const debut = d.datePlantation ?? d.dateSemis
        expect(jour(recolteApresDebut(debut!, itp)), `${nom} ${annee}`).toBe(jour(d.dateRecolte))
      }
    })
  }

  it("ail planté S42/2026 (année à 53 semaines) : récolte le lundi de la S25/2027", () => {
    const recolte = recolteApresDebut(semaineVersDate(2026, 42), CAS.ailAutomne)
    expect(jour(recolte)).toBe("2027-06-21")
  })

  it("avocatier : la récolte reste un lundi, trois ans plus tard", () => {
    const recolte = recolteApresDebut(semaineVersDate(2026, 25), CAS.avocatier)
    expect(jour(recolte)).toBe("2029-06-25")
    expect(recolte!.getDay()).toBe(1)
  })

  it("début déplacé : la durée du cycle de la saison la plus proche est préservée", () => {
    // Ail planté le jeudi 05/03/2026 au lieu de l'automne : S42/2025 → S25/2026
    // font 35 semaines, soit 245 jours.
    const recolte = recolteApresDebut(new Date(2026, 2, 5), CAS.ailAutomne)
    expect(jour(recolte)).toBe("2026-11-05")
  })

  it("garde l'heure du début (date saisie à minuit UTC)", () => {
    const debut = new Date("2026-10-12T00:00:00Z")
    const recolte = recolteApresDebut(debut, CAS.ailAutomne)
    expect(recolte!.toISOString()).toBe("2027-06-21T00:00:00.000Z")
  })

  it("retombe sur la durée de culture quand l'ITP n'a pas de semaine de récolte", () => {
    const recolte = recolteApresDebut(new Date(2026, 2, 9), { semaineSemis: 10, dureeCulture: 90 })
    expect(jour(recolte)).toBe("2026-06-07")
  })

  it("reste nul quand rien ne permet le calcul", () => {
    expect(recolteApresDebut(new Date(2026, 2, 9), {})).toBeNull()
    expect(recolteApresDebut(new Date(2026, 2, 9), { semaineSemis: 20, semaineRecolte: 20 })).toBeNull()
  })
})

describe("debutCyclePourRecolte — ancrage à passer à recolteApresDebut", () => {
  const TOMATE = { semaineSemis: 7, semainePlantation: 15, semaineRecolte: 27 }

  it("prend la plantation réelle quand elle est connue", () => {
    const plantation = new Date(2026, 3, 20)
    expect(debutCyclePourRecolte({ dateSemis: new Date(2026, 1, 9), datePlantation: plantation }, TOMATE)).toBe(
      plantation
    )
  })

  it("déduit la plantation du semis réel pour un ITP à plantation", () => {
    // Semis le 16/02/2026 (une semaine après la S7) : plantation attendue 8
    // semaines plus tard, et non le jour du semis.
    const debut = debutCyclePourRecolte({ dateSemis: new Date(2026, 1, 16) }, TOMATE)
    expect(jour(debut)).toBe("2026-04-13")
    // La récolte garde alors l'écart plantation → récolte (12 semaines).
    expect(jour(recolteApresDebut(debut!, TOMATE))).toBe("2026-07-06")
  })

  it("garde le semis pour un semis direct ou un ITP sans semaine de semis", () => {
    const semis = new Date(2026, 2, 9)
    expect(debutCyclePourRecolte({ dateSemis: semis }, { semaineSemis: 10, semaineRecolte: 20 })).toBe(semis)
    expect(debutCyclePourRecolte({ dateSemis: semis }, { semainePlantation: 15, semaineRecolte: 27 })).toBe(semis)
  })

  it("rend null sans aucune date", () => {
    expect(debutCyclePourRecolte({}, TOMATE)).toBeNull()
  })
})

describe("moisDepuisSemaine — mois de la semaine ISO", () => {
  it("range la S01 en janvier même quand son lundi tombe en décembre", () => {
    // S01 de 2026 : du lundi 29/12/2025 au dimanche 04/01/2026.
    expect(moisDepuisSemaine(2026, 1)).toBe(1)
    expect(moisDepuisSemaine(2025, 1)).toBe(1)
    expect(moisDepuisSemaine(2031, 1)).toBe(1)
  })

  it("rend toujours janvier pour une S01 et décembre pour une S52", () => {
    for (let annee = 2020; annee <= 2040; annee++) {
      expect(moisDepuisSemaine(annee, 1), `S01 ${annee}`).toBe(1)
      expect(moisDepuisSemaine(annee, 52), `S52 ${annee}`).toBe(12)
    }
  })

  it("garde le mois attendu en cours d'année", () => {
    // S22 de 2026 : du lundi 25/05 au dimanche 31/05 → mai.
    expect(moisDepuisSemaine(2026, 22)).toBe(5)
    // S27 de 2026 : son lundi est le 29/06, la date stockée sur une culture.
    // Le mois reste celui du lundi, comme sur le tableau de bord.
    expect(moisDepuisSemaine(2026, 27)).toBe(6)
  })
})
