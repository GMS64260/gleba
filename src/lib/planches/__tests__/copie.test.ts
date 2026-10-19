import { Prisma } from "@prisma/client"
import { describe, expect, it } from "vitest"

import {
  MAX_COPIES_PLANCHE,
  SELECT_SOURCE_COPIE_PLANCHE,
  SORT_COLONNE_COPIE_PLANCHE,
  attributsCopiePlanche,
  planCopiesPlanche,
  type PlancheSourceCopie,
} from "../copie"

/** Planche de terrain complète, telle que la route la relit en base. */
const SOURCE: PlancheSourceCopie = {
  nom: "Successions",
  posX: 2,
  posY: 5,
  largeur: 1.2,
  longueur: 15,
  surface: 18,
  rotation2D: 0,
  ilot: "Îlot nord",
  parcelleGeoId: "parcelle-1",
  type: "Plein champ",
  irrigation: "Goutte-a-goutte",
  rotationId: "rotation-1",
  annee: 2026,
  typeSol: "Limoneux",
  retentionEau: "Moyenne",
  argile: 18,
  limon: 60,
  sable: 22,
  phSol: 6.8,
  carboneOrg: 2.1,
  derniereAnalyseSol: new Date("2026-03-01T00:00:00Z"),
}

describe("copie d'une planche (ticket QA du 2026-10-19)", () => {
  it("reprend îlot, type, sol, rétention et rotation de la source", () => {
    const copie = attributsCopiePlanche(SOURCE)
    expect(copie).toMatchObject({
      ilot: "Îlot nord",
      type: "Plein champ",
      typeSol: "Limoneux",
      retentionEau: "Moyenne",
      rotationId: "rotation-1",
      annee: 2026,
      irrigation: "Goutte-a-goutte",
      parcelleGeoId: "parcelle-1",
      largeur: 1.2,
      longueur: 15,
      surface: 18,
      rotation2D: 0,
    })
  })

  it("ne reprend ni l'identité ni la position de la source", () => {
    const copie = attributsCopiePlanche(SOURCE) as Record<string, unknown>
    for (const champ of ["id", "nom", "userId", "posX", "posY"]) expect(copie).not.toHaveProperty(champ)
  })

  it("chaque colonne de la planche est classée, et toute colonne de terrain est copiée", () => {
    const colonnes = Object.values(Prisma.PlancheScalarFieldEnum).sort()
    expect(Object.keys(SORT_COLONNE_COPIE_PLANCHE).sort()).toEqual(colonnes)

    const terrain = Object.entries(SORT_COLONNE_COPIE_PLANCHE)
      .filter(([, sort]) => sort === "terrain")
      .map(([colonne]) => colonne)
      .sort()
    expect(Object.keys(attributsCopiePlanche(SOURCE)).sort()).toEqual(terrain)
    // La route relit exactement ce terrain, plus nom et position.
    expect(Object.keys(SELECT_SOURCE_COPIE_PLANCHE).sort()).toEqual(
      [...terrain, "nom", "posX", "posY"].sort(),
    )
  })

  it("le statut bio n'est pas déclaré par une copie", () => {
    expect(SORT_COLONNE_COPIE_PLANCHE.statutBio).toBe("propre")
    expect(SORT_COLONNE_COPIE_PLANCHE.nCertificat).toBe("propre")
  })

  it("recalcule la surface depuis les dimensions, garde la surface saisie seule", () => {
    expect(attributsCopiePlanche({ ...SOURCE, surface: 99 }).surface).toBe(18)
    expect(attributsCopiePlanche({ ...SOURCE, largeur: null, longueur: null, surface: 12 }).surface).toBe(12)
  })

  it("numérote depuis le nom de base et pose les copies côte à côte, 0,4 m d'écart", () => {
    const plan = planCopiesPlanche(SOURCE, 2, ["Successions", "Successions (2)", "Autre"])
    expect(plan).toEqual([
      { nom: "Successions (3)", posX: 3.6, posY: 5 },
      { nom: "Successions (4)", posX: 5.2, posY: 5 },
    ])
  })

  it("suit l'orientation de la planche", () => {
    const [copie] = planCopiesPlanche({ ...SOURCE, rotation2D: 90 }, 1, [])
    expect(copie.posX).toBeCloseTo(2, 5)
    expect(copie.posY).toBeCloseTo(6.6, 5)
  })

  it("borne le nombre de copies", () => {
    expect(planCopiesPlanche(SOURCE, 500, [])).toHaveLength(MAX_COPIES_PLANCHE)
    expect(planCopiesPlanche(SOURCE, 0, [])).toHaveLength(1)
  })
})
