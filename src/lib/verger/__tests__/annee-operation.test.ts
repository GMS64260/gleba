/**
 * QA 2026-10-19 — Verger > Opérations : le sélecteur d'année était conservé
 * mais la liste et le coût restaient ceux de toutes les années (une taille
 * prévue le 15/07/2027 et des tailles de février 2026 listées sous 2025).
 */
import { describe, expect, it } from "vitest"

import {
  anneeOperationArbre,
  dateReferenceOperationArbre,
  operationArbreDansAnnee,
  resumeCoutOperations,
  whereOperationsArbreAnnee,
} from "../annee-operation"
import { ONGLETS_VERGER_PAR_ANNEE, ongletVergerSuitAnnee } from "../annee-verger"

// Dates telles que la route les stocke : `new Date("AAAA-MM-JJ")`.
const tailleEte2027 = { fait: false, date: "2027-07-15T00:00:00.000Z", datePrevue: "2027-07-15T00:00:00.000Z", cout: 0 }
const tailleFevrier2026 = { fait: true, date: "2026-02-12T00:00:00.000Z", datePrevue: null, cout: 42 }
// Prévue fin 2025, réalisée début 2026 : elle compte en 2026, l'année de sa réalisation.
const realiseeAnneeSuivante = { fait: true, date: "2026-01-08T10:00:00.000Z", datePrevue: "2025-12-20T00:00:00.000Z", cout: 10 }
// À faire, prévue en 2025 alors que `date` porte la date de saisie 2024.
const aFaire2025 = { fait: false, date: "2024-11-02T00:00:00.000Z", datePrevue: "2025-03-10T00:00:00.000Z", cout: 5 }

describe("année d'une opération du verger", () => {
  it("une opération à faire se range à sa date prévue", () => {
    expect(anneeOperationArbre(tailleEte2027)).toBe(2027)
    expect(anneeOperationArbre(aFaire2025)).toBe(2025)
  })

  it("une opération réalisée se range à sa date de réalisation", () => {
    expect(anneeOperationArbre(tailleFevrier2026)).toBe(2026)
    expect(anneeOperationArbre(realiseeAnneeSuivante)).toBe(2026)
  })

  it("à défaut de date prévue, une opération à faire se range à sa date", () => {
    expect(anneeOperationArbre({ fait: false, date: "2026-05-01T00:00:00.000Z", datePrevue: null })).toBe(2026)
  })

  it("sans date exploitable : aucune année", () => {
    expect(dateReferenceOperationArbre({ fait: true, date: null, datePrevue: null })).toBeNull()
    expect(anneeOperationArbre({ fait: false, date: "pas une date", datePrevue: null })).toBeNull()
  })

  it("scénario du signalement : 2025 ne montre ni la taille de 2027 ni celles de février 2026", () => {
    const toutes = [tailleEte2027, tailleFevrier2026, realiseeAnneeSuivante, aFaire2025]
    expect(toutes.filter((op) => operationArbreDansAnnee(op, 2025))).toEqual([aFaire2025])
    expect(toutes.filter((op) => operationArbreDansAnnee(op, 2027))).toEqual([tailleEte2027])
    expect(toutes.filter((op) => operationArbreDansAnnee(op, 2026))).toEqual([tailleFevrier2026, realiseeAnneeSuivante])
  })
})

describe("whereOperationsArbreAnnee (même règle côté route)", () => {
  // Évaluateur minimal du filtre Prisma produit, pour vérifier qu'il range
  // chaque opération exactement comme le helper de l'écran.
  type Borne = { gte: Date; lt: Date }
  type Clause = { fait: boolean; date?: Borne; datePrevue?: Borne | null }
  const dans = (valeur: string | null, borne: Borne) =>
    valeur !== null && new Date(valeur) >= borne.gte && new Date(valeur) < borne.lt
  const satisfait = (op: { fait: boolean; date: string | null; datePrevue: string | null }, clause: Clause) =>
    op.fait === clause.fait &&
    (clause.date === undefined || dans(op.date, clause.date)) &&
    (clause.datePrevue === undefined ||
      (clause.datePrevue === null ? op.datePrevue === null : dans(op.datePrevue, clause.datePrevue)))

  it("filtre exactement les opérations que l'écran range dans l'année", () => {
    const toutes = [tailleEte2027, tailleFevrier2026, realiseeAnneeSuivante, aFaire2025]
    for (const annee of [2024, 2025, 2026, 2027]) {
      const where = whereOperationsArbreAnnee(annee)
      const parRoute = toutes.filter((op) => (where.OR as Clause[]).some((clause) => satisfait(op, clause)))
      expect(parRoute).toEqual(toutes.filter((op) => operationArbreDansAnnee(op, annee)))
    }
  })

  it("bornes locales, la fin exclusive au 1er janvier suivant", () => {
    const where = whereOperationsArbreAnnee(2026)
    expect(where.OR[0]).toEqual({ fait: true, date: { gte: new Date(2026, 0, 1), lt: new Date(2027, 0, 1) } })
  })
})

describe("resumeCoutOperations", () => {
  it("sépare le réalisé du prévu", () => {
    expect(resumeCoutOperations([tailleFevrier2026, realiseeAnneeSuivante, aFaire2025, { fait: false, cout: null }])).toEqual({
      total: 57,
      realise: 52,
      prevu: 5,
    })
  })
})

describe("portée du sélecteur d'année du verger", () => {
  it("filtre le Calendrier et les Opérations, et annonce « Toutes années » ailleurs", () => {
    expect([...ONGLETS_VERGER_PAR_ANNEE]).toEqual(["calendrier", "operations"])
    expect(ongletVergerSuitAnnee("operations")).toBe(true)
    expect(ongletVergerSuitAnnee("sante")).toBe(false)
    expect(ongletVergerSuitAnnee("productions")).toBe(false)
  })
})
