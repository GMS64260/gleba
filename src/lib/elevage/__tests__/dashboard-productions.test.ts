import { describe, expect, it, vi } from "vitest"

import {
  aUneActiviteOeufsDashboard,
  agregerProductionsLaitieresDashboard,
  agregerVentesDashboard,
  construireProductionsDashboard,
  construireVentesDashboard,
} from "../dashboard-productions"

describe("aUneActiviteOeufsDashboard", () => {
  it("masque les éléments œufs sans atelier ni production pour l’année", () => {
    expect(aUneActiviteOeufsDashboard({
      animauxPondeursActifs: 0,
      lotsPondeursActifs: 0,
      oeufsProduitsAnnee: 0,
    })).toBe(false)
  })

  it.each([
    { animauxPondeursActifs: 1, lotsPondeursActifs: 0, oeufsProduitsAnnee: 0 },
    { animauxPondeursActifs: 0, lotsPondeursActifs: 12, oeufsProduitsAnnee: 0 },
    { animauxPondeursActifs: 0, lotsPondeursActifs: 0, oeufsProduitsAnnee: 240 },
  ])("affiche les éléments œufs dès qu’une activité pertinente existe", (activite) => {
    expect(aUneActiviteOeufsDashboard(activite)).toBe(true)
  })
})

describe("construireVentesDashboard", () => {
  it("ventile les montants par mois et conserve les catégories dynamiques", () => {
    const resultat = construireVentesDashboard([
      { type: "oeufs", date: new Date(2025, 0, 8), prixTotal: 120.555 },
      { type: "lait", date: new Date(2025, 0, 9), prixTotal: 80 },
      { type: "oeufs", date: new Date(2025, 1, 2), prixTotal: 45.2 },
      { type: "laine_brute", date: new Date(2025, 11, 2), prixTotal: 350 },
    ])

    expect(resultat.categories).toEqual([
      { categorie: "oeufs", label: "Œufs" },
      { categorie: "lait", label: "Lait" },
      { categorie: "laine_brute", label: "Laine brute" },
    ])
    expect(resultat.mois).toHaveLength(12)
    expect(resultat.mois[0]).toMatchObject({ mois: 1, label: "Jan.", oeufs: 120.56, lait: 80 })
    expect(resultat.mois[1]).toMatchObject({ mois: 2, label: "Fév.", oeufs: 45.2 })
    expect(resultat.mois[11]).toMatchObject({ mois: 12, label: "Déc.", laine_brute: 350 })
  })

  it("renvoie un état vide sans ventes", () => {
    const resultat = construireVentesDashboard([])
    expect(resultat.categories).toEqual([])
    expect(resultat.mois).toHaveLength(12)
  })

  it("filtre explicitement par exploitation, année et ventes non annulées", async () => {
    const findMany = vi.fn().mockResolvedValue([])
    const debut = new Date(2025, 0, 1)
    const fin = new Date(2025, 11, 31, 23, 59, 59)

    await agregerVentesDashboard({ venteProduit: { findMany } }, "exploitation-a", debut, fin)

    expect(findMany).toHaveBeenCalledWith({
      where: { userId: "exploitation-a", annule: false, date: { gte: debut, lte: fin } },
      select: { type: true, date: true, prixTotal: true },
      orderBy: { date: "asc" },
    })
  })
})

describe("construireProductionsDashboard", () => {
  it("affiche simultanément chaque production avec son unité", () => {
    expect(construireProductionsDashboard({
      oeufs: 240,
      laitLitres: 123.456,
      fromagePieces: 48,
      fromageKg: 9.876,
      viandeKg: 32.555,
    })).toEqual([
      { type: "oeufs", label: "Œufs", quantite: 240, unite: "œufs" },
      { type: "lait", label: "Lait collecté", quantite: 123.46, unite: "L" },
      { type: "fromage", label: "Fromages fabriqués", quantite: 48, unite: "pièces", detail: "9.88 kg au total" },
      { type: "viande", label: "Viande (carcasse)", quantite: 32.56, unite: "kg" },
    ])
  })

  it("omet les catégories absentes et renvoie un état vide exploitable", () => {
    expect(construireProductionsDashboard({
      oeufs: 0,
      laitLitres: 0,
      fromagePieces: 0,
      fromageKg: 0,
      viandeKg: 0,
    })).toEqual([])
  })

  it("affiche un fromage enregistré uniquement au poids", () => {
    expect(construireProductionsDashboard({
      oeufs: 0, laitLitres: 0, fromagePieces: 0, fromageKg: 12.345, viandeKg: 0,
    })).toEqual([
      { type: "fromage", label: "Fromages fabriqués", quantite: 12.35, unite: "kg" },
    ])
  })

  it("affiche un fromage enregistré uniquement en pièces", () => {
    expect(construireProductionsDashboard({
      oeufs: 0, laitLitres: 0, fromagePieces: 18, fromageKg: 0, viandeKg: 0,
    })).toEqual([
      { type: "fromage", label: "Fromages fabriqués", quantite: 18, unite: "pièces" },
    ])
  })
})

describe("agregerProductionsLaitieresDashboard", () => {
  it("limite chaque source à l'exploitation et à l'année sélectionnée", async () => {
    const collecteLait = { aggregate: vi.fn().mockResolvedValue({ _sum: { quantiteLitres: 125.5 }, _count: 4 }) }
    const lotFromage = { aggregate: vi.fn().mockResolvedValue({ _sum: { nbPieces: 8, poidsTotalKg: 3.2 } }) }
    const debut = new Date(2025, 0, 1)
    const fin = new Date(2025, 11, 31, 23, 59, 59)

    await expect(agregerProductionsLaitieresDashboard(
      { collecteLait, lotFromage }, "exploitation-a", debut, fin
    )).resolves.toEqual({ laitLitres: 125.5, nbCollectes: 4, fromagePieces: 8, fromageKg: 3.2 })

    expect(collecteLait.aggregate).toHaveBeenCalledWith({
      where: { userId: "exploitation-a", date: { gte: debut, lte: fin } },
      _sum: { quantiteLitres: true },
      _count: true,
    })
    expect(lotFromage.aggregate).toHaveBeenCalledWith({
      where: { userId: "exploitation-a", dateFabrication: { gte: debut, lte: fin } },
      _sum: { nbPieces: true, poidsTotalKg: true },
    })
  })
})
