/**
 * Tuile « Carte » de l'accueil : les parcelles cadastrales (GeoJSON) posées
 * dans une boîte SVG, projection plate corrigée par le cosinus de la
 * latitude moyenne, cadre ajusté aux parcelles avec une marge. Fonction PURE,
 * tolérante : une géométrie illisible est ignorée, jamais une exception.
 */

export interface ParcelleCarte {
  id: string
  nom: string
  /** GeoJSON Polygon ou MultiPolygon, tel qu'en base. */
  geometry: string
  couleur: string | null
  surfaceHa: number | null
  usage: string | null
}

export interface FormeCarte {
  id: string
  nom: string
  /** Attribut `points` d'un <polygon>, un par anneau extérieur. */
  anneaux: string[]
  couleur: string | null
}

export interface CarteVignette {
  largeur: number
  hauteur: number
  formes: FormeCarte[]
}

type Position = [number, number]

function anneauxExterieurs(geometry: string): Position[][] {
  try {
    const g = JSON.parse(geometry) as { type?: string; coordinates?: unknown }
    if (g.type === "Polygon" && Array.isArray(g.coordinates)) return [g.coordinates[0] as Position[]].filter(Array.isArray)
    if (g.type === "MultiPolygon" && Array.isArray(g.coordinates)) {
      return (g.coordinates as Position[][][]).map((poly) => poly[0]).filter(Array.isArray)
    }
  } catch {
    // géométrie illisible : parcelle ignorée
  }
  return []
}

export function projeterParcelles(
  parcelles: readonly ParcelleCarte[],
  options: { largeur?: number; hauteur?: number; marge?: number } = {},
): CarteVignette {
  const largeur = options.largeur ?? 320
  const hauteur = options.hauteur ?? 180
  const marge = options.marge ?? 10
  const brutes = parcelles
    .map((p) => ({ p, anneaux: anneauxExterieurs(p.geometry).filter((a) => a.length >= 3) }))
    .filter((x) => x.anneaux.length > 0)
  if (brutes.length === 0) return { largeur, hauteur, formes: [] }

  const points = brutes.flatMap((x) => x.anneaux.flat())
  const lats = points.map((pt) => pt[1])
  const latMoy = lats.reduce((s, v) => s + v, 0) / lats.length
  const k = Math.cos((latMoy * Math.PI) / 180) || 1
  const xs = points.map((pt) => pt[0] * k)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...lats)
  const maxY = Math.max(...lats)
  const etendueX = Math.max(maxX - minX, 1e-9)
  const etendueY = Math.max(maxY - minY, 1e-9)
  const echelle = Math.min((largeur - 2 * marge) / etendueX, (hauteur - 2 * marge) / etendueY)
  const decX = (largeur - etendueX * echelle) / 2
  const decY = (hauteur - etendueY * echelle) / 2
  const projeter = (pt: Position) => {
    const x = (pt[0] * k - minX) * echelle + decX
    const y = (maxY - pt[1]) * echelle + decY
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }
  return {
    largeur,
    hauteur,
    formes: brutes.map(({ p, anneaux }) => ({
      id: p.id,
      nom: p.nom,
      anneaux: anneaux.map((a) => a.map(projeter).join(" ")),
      couleur: p.couleur,
    })),
  }
}
