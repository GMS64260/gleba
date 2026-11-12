import { describe, expect, it } from "vitest"
import { calculateCentroid, calculateSurfaceHa } from "./geo-utils"

/**
 * GEO-01 (revue Codex du 2026-11-12) : la surface et le centroïde d'une
 * parcelle ne lisaient que le premier anneau de la première composante.
 * Une parcelle en plusieurs morceaux, ou percée d'un trou (mare, bâtiment),
 * était fausse, et le ratio de cuivre par hectare avec elle. La surface était
 * aussi arrondie à 0,01 ha AVANT stockage : moins de 50 m² devenait 0.
 */

type Anneau = number[][]
const carre = (x: number, y: number, d: number): Anneau => [[x, y], [x + d, y], [x + d, y + d], [x, y + d], [x, y]]
const polygone = (...anneaux: Anneau[]) => JSON.stringify({ type: "Polygon", coordinates: anneaux })
const multi = (...polygones: Anneau[][]) => JSON.stringify({ type: "MultiPolygon", coordinates: polygones })

const P1 = carre(0, 45, 0.001)
const P2 = carre(0.002, 45, 0.001)
const TROU = carre(0.00025, 45.00025, 0.0005)

describe("calculateSurfaceHa", () => {
  it("un carré simple garde sa surface (≈ 0,88 ha à 45° de latitude)", () => {
    expect(calculateSurfaceHa(polygone(P1))).toBeCloseTo(0.8762, 3)
  })

  it("MultiPolygon : somme des composantes", () => {
    const attendu = calculateSurfaceHa(polygone(P1))! + calculateSurfaceHa(polygone(P2))!
    expect(calculateSurfaceHa(multi([P1], [P2]))).toBeCloseTo(attendu, 6)
    expect(attendu).toBeCloseTo(1.75, 1)
  })

  it("Polygon troué : extérieur moins le trou", () => {
    const attendu = calculateSurfaceHa(polygone(P1))! - calculateSurfaceHa(polygone(TROU))!
    expect(calculateSurfaceHa(polygone(P1, TROU))).toBeCloseTo(attendu, 6)
    expect(attendu).toBeCloseTo(0.66, 2)
  })

  it("MultiPolygon dont une composante est trouée", () => {
    const attendu = calculateSurfaceHa(polygone(P1))! - calculateSurfaceHa(polygone(TROU))! + calculateSurfaceHa(polygone(P2))!
    expect(calculateSurfaceHa(multi([P1, TROU], [P2]))).toBeCloseTo(attendu, 6)
  })

  it("le sens de parcours d'un anneau ne change rien", () => {
    const trouInverse = [...TROU].reverse()
    expect(calculateSurfaceHa(polygone(P1, trouInverse))).toBeCloseTo(calculateSurfaceHa(polygone(P1, TROU))!, 9)
    expect(calculateSurfaceHa(polygone([...P1].reverse()))).toBeCloseTo(calculateSurfaceHa(polygone(P1))!, 9)
  })

  it("garde la précision : un rectangle de ≈ 22 m² ne vaut pas 0 ha", () => {
    const petit = calculateSurfaceHa(polygone(carre(0, 45, 0.00005)))!
    expect(petit).toBeGreaterThan(0.0021)
    expect(petit).toBeLessThan(0.0023)
  })

  it("géométrie illisible ou d'un autre type : null", () => {
    expect(calculateSurfaceHa("pas du json")).toBeNull()
    expect(calculateSurfaceHa(JSON.stringify({ type: "Point", coordinates: [0, 45] }))).toBeNull()
    expect(calculateSurfaceHa(JSON.stringify({ type: "Polygon", coordinates: [] }))).toBeNull()
  })
})

describe("calculateCentroid", () => {
  it("carré simple : son centre", () => {
    const c = calculateCentroid(polygone(P1))!
    expect(c.lng).toBeCloseTo(0.0005, 9)
    expect(c.lat).toBeCloseTo(45.0005, 9)
  })

  it("deux composantes égales : le milieu des deux, pas le centre de la première", () => {
    const c = calculateCentroid(multi([P1], [P2]))!
    expect(c.lng).toBeCloseTo(0.0015, 9)
    expect(c.lat).toBeCloseTo(45.0005, 9)
  })

  it("un trou décentré écarte le centroïde du trou", () => {
    const trouEst = carre(0.0006, 45.0004, 0.0002)
    const c = calculateCentroid(polygone(P1, trouEst))!
    expect(c.lng).toBeLessThan(0.0005)
    expect(c.lat).toBeCloseTo(45.0005, 9)
  })

  it("géométrie illisible : null", () => {
    expect(calculateCentroid("{")).toBeNull()
  })
})

// Reliquat GEO-01 (contre-revue Codex) : un trou `null` passait le schéma
// (seul le premier anneau était contrôlé) puis faisait lever le centroïde.
describe("géométrie mal formée", () => {
  const ring = (x: number, y: number, w: number, h: number) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]
  const A = ring(0, 45, 0.001, 0.001)
  const malformees = [
    JSON.stringify({ type: "Polygon", coordinates: [A, null] }),
    JSON.stringify({ type: "MultiPolygon", coordinates: [[A], [A, null]] }),
    JSON.stringify({ type: "MultiPolygon", coordinates: [[A], [[[0, 45], [1, 45], [1, 46]]]] }),
  ]

  it("refusée à l'enregistrement : tous les anneaux de toutes les composantes sont contrôlés", async () => {
    const { geometrieParcelleValide } = await import("./geo-utils")
    const { createParcelleSchema } = await import("./validations/parcelle")
    for (const g of malformees) {
      expect(geometrieParcelleValide(g)).toBe(false)
      expect(createParcelleSchema.safeParse({ nom: "synthetique", geometry: g }).success).toBe(false)
    }
    expect(geometrieParcelleValide(JSON.stringify({ type: "Polygon", coordinates: [A] }))).toBe(true)
  })

  it("lue sans exception si elle est déjà en base : l'anneau illisible est ignoré", async () => {
    const { calculateCentroid, calculateSurfaceHa } = await import("./geo-utils")
    const seul = calculateSurfaceHa(JSON.stringify({ type: "Polygon", coordinates: [A] }))
    for (const g of malformees.slice(0, 2)) {
      expect(() => calculateCentroid(g)).not.toThrow()
      expect(calculateCentroid(g)).not.toBeNull()
      expect(calculateSurfaceHa(g)).toBeGreaterThanOrEqual(seul ?? 0)
    }
  })
})

