import { describe, expect, it } from "vitest"

import type { AlerteAssociation } from "./associations-alertes"
import {
  assemblerAssociations,
  cohabitent,
  coinsPlanche,
  distancePlanches,
  liaisonEntrePlanches,
  type CultureVoisinage,
  type PlancheGeo,
} from "./associations-voisinage"

const planche = (nom: string, posX: number, posY: number, extra: Partial<PlancheGeo> = {}): PlancheGeo => ({
  id: `id-${nom}`,
  nom,
  posX,
  posY,
  largeur: 0.8,
  longueur: 20,
  rotation2D: 0,
  ...extra,
})

const culture = (
  plancheId: string,
  especeId: string,
  debut: number | null,
  recolte: number | null,
  semainesRecolte: number | null = 2
): CultureVoisinage => ({
  plancheId,
  ilot: null,
  especeId,
  semaineSemis: null,
  semainePlantation: debut,
  semaineRecolte: recolte,
  semainesRecolte,
})

const alerte = (a: string, b: string, type: "favorable" | "defavorable"): AlerteAssociation => ({
  type,
  especes: [a, b],
  message: `${a} ↔ ${b}`,
  associationId: "x",
})

describe("géométrie des planches", () => {
  const dist = (a: PlancheGeo, b: PlancheGeo) =>
    distancePlanches(coinsPlanche(a) as never, coinsPlanche(b) as never)

  it("mesure l'écart de deux planches parallèles", () => {
    expect(dist(planche("A", 0, 0), planche("B", 2, 0))).toBeCloseTo(1.2)
    expect(dist(planche("A", 0, 0), planche("B", 0.8, 0))).toBeCloseTo(0)
  })

  it("tient compte de la rotation autour du centre", () => {
    // 0,8 × 20 m tournées à 90° : elles s'étendent en x, plus en y.
    const a = planche("A", 0, 0, { rotation2D: 90 })
    const loin = planche("B", 0, 5, { rotation2D: 90 })
    const proche = planche("C", 0, 1.2, { rotation2D: 90 })
    expect(dist(a, loin)).toBeCloseTo(4.2)
    expect(dist(a, proche)).toBeCloseTo(0.4)
    // Sans rotation les boîtes se recouvraient : distance 0.
    expect(dist(planche("A", 0, 0), planche("B", 0, 5))).toBe(0)
  })

  it("prend les dimensions par défaut du plan, et rien sans position", () => {
    expect(coinsPlanche(planche("A", 0, 0, { largeur: null, longueur: 0 }))).toEqual([
      { x: 0, y: 0 },
      { x: 0.8, y: 0 },
      { x: 0.8, y: 2 },
      { x: 0, y: 2 },
    ])
    expect(coinsPlanche(planche("A", 0, 0, { posX: null }))).toBeNull()
  })
})

describe("cohabitent", () => {
  it("compare les périodes d'occupation, récolte comprise", () => {
    const radis = culture("A", "Radis", 10, 14)
    expect(cohabitent(radis, culture("B", "Tomate", 20, 30, 10))).toBe(false)
    expect(cohabitent(culture("A", "Tomate", 20, 30, 10), culture("B", "Laitue", 35, 42))).toBe(true)
    // Ail planté S42, récolté S26 de l'année suivante.
    expect(cohabitent(culture("A", "Ail", 42, 26), culture("B", "Mâche", 45, 50))).toBe(true)
    expect(cohabitent(radis, culture("B", "Tomate", 20, null))).toBeNull()
    expect(cohabitent(radis, culture("B", "Tomate", 12, 30, null))).toBeNull()
  })
})

describe("assemblerAssociations", () => {
  const planches = [planche("A", 0, 0), planche("B", 1.2, 0), planche("Z", 50, 50)]

  it("n'associe pas deux cultures voisines qui ne sont jamais en place ensemble", () => {
    const lignes = assemblerAssociations(
      [culture("A", "Radis", 10, 14), culture("B", "Tomate", 20, 30, 10)],
      planches,
      [alerte("radis", "tomate", "favorable")]
    )
    expect(lignes[0].planchesVoisines).toEqual(["B"])
    expect(lignes[0].culturesVoisines).toEqual([])
    expect(lignes[0].scoreAssociation).toBe("neutre")
  })

  it("garde une voisine dont la période est inconnue", () => {
    const lignes = assemblerAssociations(
      [culture("A", "Ail", 10, 26), culture("B", "Haricot", null, null)],
      planches,
      [alerte("ail", "haricot", "defavorable")]
    )
    expect(lignes[0].culturesVoisines).toMatchObject([{ plancheId: "B", eval: "defavorable" }])
    expect(lignes[0].scoreAssociation).toBe("defavorable")
  })

  it("compare les cultures d'une même planche quand elles cohabitent, pas une succession", () => {
    const cultures = [culture("A", "Ail", 10, 26), culture("A", "Haricot", 20, 30), culture("A", "Pois", 35, 45)]
    const lignes = assemblerAssociations(cultures, planches, [
      alerte("ail", "haricot", "defavorable"),
      alerte("ail", "pois", "defavorable"),
    ])
    expect(lignes[0].culturesVoisines).toEqual([
      expect.objectContaining({ plancheId: "A", especeId: "Haricot", eval: "defavorable", memePlanche: true }),
    ])
    expect(lignes[2].culturesVoisines).toEqual([])
    // Périodes inconnues sur la même planche : pas d'alerte de succession.
    const sansDates = assemblerAssociations(
      [culture("A", "Ail", null, null), culture("A", "Haricot", null, null)],
      planches,
      [alerte("ail", "haricot", "defavorable")]
    )
    expect(sansDates[0].culturesVoisines).toEqual([])
  })

  it("ignore une liste de planches influencées périmée, suit une liste valide", () => {
    const cultures = [culture("A", "Ail", 10, 26)]
    const perimee = assemblerAssociations(cultures, [planche("A", 0, 0, { planchesInfluencees: "Ancienne, A" }), planches[1]], [])
    expect(perimee[0].planchesVoisines).toEqual(["B"])
    const valide = assemblerAssociations(cultures, [planche("A", 0, 0, { planchesInfluencees: "Z" }), planches[1], planches[2]], [])
    expect(valide[0].planchesVoisines).toEqual(["Z"])
  })

  it("rend le nom des espèces à côté de leur identifiant", () => {
    const lignes = assemblerAssociations(
      [culture("A", "cmx123", 10, 26), culture("B", "Ail", 10, 26)],
      planches,
      [],
      new Map([["cmx123", "Tomate ancienne"]])
    )
    expect(lignes[0].cultureEspeceNom).toBe("Tomate ancienne")
    expect(lignes[1].culturesVoisines[0]).toMatchObject({ especeId: "cmx123", especeNom: "Tomate ancienne" })
  })
})

describe("liaisonEntrePlanches", () => {
  const ailContre = {
    id: "ail-contre",
    nom: "Ail !",
    type: "incompatible",
    details: [
      { especeId: "Ail", familleId: "Alliaceae", requise: true },
      { especeId: "Artichaut", familleId: "Asteraceae", requise: false },
    ],
  }
  const basilicTomate = {
    id: "basilic-tomate",
    nom: "Basilic + Tomate",
    type: "favorable",
    details: [
      { especeId: "Basilic", familleId: "Lamiaceae", requise: true },
      { especeId: "Tomate", familleId: "Solanaceae", requise: false },
    ],
  }
  const esp = (id: string, famille: string) => ({ id, nom: id, famille: { id: famille } })

  it("ne relie pas deux espèces par la famille d'annotation d'une ligne d'espèce", () => {
    expect(liaisonEntrePlanches([ailContre], [esp("Oignon", "Alliaceae")], [esp("Laitue", "Asteraceae")])).toBeNull()
    expect(
      liaisonEntrePlanches([basilicTomate], [esp("Menthe", "Lamiaceae")], [esp("Pomme de terre", "Solanaceae")])
    ).toBeNull()
  })

  it("relie les espèces nommées, l'incompatibilité primant", () => {
    expect(liaisonEntrePlanches([ailContre], [esp("Ail", "Alliaceae")], [esp("Artichaut", "Asteraceae")])).toBe(
      "incompatible"
    )
    expect(
      liaisonEntrePlanches(
        [ailContre, basilicTomate],
        [esp("Ail", "Alliaceae"), esp("Basilic", "Lamiaceae")],
        [esp("Artichaut", "Asteraceae"), esp("Tomate", "Solanaceae")]
      )
    ).toBe("incompatible")
    expect(liaisonEntrePlanches([basilicTomate], [esp("Basilic", "Lamiaceae")], [esp("Tomate", "Solanaceae")])).toBe(
      "favorable"
    )
  })

  it("ne trace rien pour une paire interne à une planche", () => {
    expect(
      liaisonEntrePlanches([basilicTomate], [esp("Basilic", "Lamiaceae"), esp("Tomate", "Solanaceae")], [esp("Laitue", "Asteraceae")])
    ).toBeNull()
  })
})
