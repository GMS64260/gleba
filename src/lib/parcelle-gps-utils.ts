/**
 * Association d'un relevé WGS84 à la parcelle la plus proche.
 *
 * Les calculs sont faits dans un petit repère métrique local centré sur le
 * relevé. Cette approximation équirectangulaire est largement suffisante à
 * l'échelle d'une exploitation et garde ce module utilisable côté client.
 */

type CoordGps = [number, number]

export interface ParcelleGps {
  id: string
  geometry: string
}

const METRES_PAR_DEGRE = 111_319.49079327358

function estCoordGps(value: unknown): value is CoordGps {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    Number.isFinite(value[0]) &&
    typeof value[1] === "number" &&
    Number.isFinite(value[1])
  )
}

function polygones(geometryGeoJson: string): CoordGps[][][] | null {
  try {
    const geometry = JSON.parse(geometryGeoJson) as {
      type?: unknown
      coordinates?: unknown
    }
    if (geometry.type === "Polygon" && Array.isArray(geometry.coordinates)) {
      const polygon = geometry.coordinates
      return polygon.every(
        (anneau): anneau is CoordGps[] =>
          Array.isArray(anneau) && anneau.length >= 3 && anneau.every(estCoordGps)
      )
        ? [polygon]
        : null
    }
    if (geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates)) {
      return geometry.coordinates.every(
        (polygon): polygon is CoordGps[][] =>
          Array.isArray(polygon) &&
          polygon.every(
            (anneau) =>
              Array.isArray(anneau) && anneau.length >= 3 && anneau.every(estCoordGps)
          )
      )
        ? geometry.coordinates
        : null
    }
  } catch {
    return null
  }
  return null
}

function pointDansAnneau(points: Array<{ x: number; y: number }>): boolean {
  let dedans = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]
    const b = points[j]
    if (
      (a.y > 0) !== (b.y > 0) &&
      0 < ((b.x - a.x) * -a.y) / (b.y - a.y) + a.x
    ) {
      dedans = !dedans
    }
  }
  return dedans
}

function distanceSegmentOrigine(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const longueur2 = dx * dx + dy * dy
  if (longueur2 === 0) return Math.hypot(a.x, a.y)
  const t = Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / longueur2))
  return Math.hypot(a.x + t * dx, a.y + t * dy)
}

export function distancePointParcelleMetres(params: {
  lat: number
  lng: number
  geometryGeoJson: string
}): number | null {
  const { lat, lng, geometryGeoJson } = params
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null
  }
  const parsed = polygones(geometryGeoJson)
  if (!parsed) return null

  const cosLat = Math.cos((lat * Math.PI) / 180)
  let distanceMin = Infinity

  for (const polygon of parsed) {
    const anneaux = polygon.map((anneau) =>
      anneau.map(([pointLng, pointLat]) => ({
        x: (pointLng - lng) * METRES_PAR_DEGRE * cosLat,
        y: (pointLat - lat) * METRES_PAR_DEGRE,
      }))
    )
    const dansExterieur = pointDansAnneau(anneaux[0])
    const dansTrou = anneaux.slice(1).some(pointDansAnneau)
    if (dansExterieur && !dansTrou) return 0

    for (const anneau of anneaux) {
      for (let index = 0; index < anneau.length; index++) {
        distanceMin = Math.min(
          distanceMin,
          distanceSegmentOrigine(anneau[index], anneau[(index + 1) % anneau.length])
        )
      }
    }
  }

  return Number.isFinite(distanceMin) ? distanceMin : null
}

/**
 * Faut-il inférer la parcelle depuis les coordonnées ?
 *
 * Corrigé le 2026-08-03. La garde d'origine était « le payload ne mentionne pas
 * `parcelleGeoId` », ce qui rendait l'inférence inatteignable depuis la fiche
 * arbre : cet écran renvoie l'objet complet, donc le champ y est toujours
 * présent, à null quand l'arbre n'a pas de parcelle. Un compte de production
 * avait ainsi 13 arbres géolocalisés — 10 à moins de 25 m d'une parcelle
 * cartographiée — et aucun rattaché.
 *
 * La bonne question n'est pas « le champ est-il absent » mais « l'utilisateur
 * a-t-il fait un geste délibéré » : on n'infère que sur de NOUVELLES coordonnées,
 * quand l'arbre n'a pas déjà de parcelle et qu'aucune n'a été choisie. Un
 * « aucune parcelle » explicite sur un arbre déjà géolocalisé est donc respecté,
 * puisque sa position ne change pas.
 */
export function doitInfererParcelle(params: {
  parcelleChoisie: string | null
  parcelleExistante: string | null
  coordonneesFournies: boolean
  lat: number | null
  lng: number | null
  latExistante: number | null
  lngExistante: number | null
}): boolean {
  const {
    parcelleChoisie,
    parcelleExistante,
    coordonneesFournies,
    lat,
    lng,
    latExistante,
    lngExistante,
  } = params
  if (parcelleChoisie || parcelleExistante) return false
  if (!coordonneesFournies) return false
  if (lat == null || lng == null) return false
  return lat !== latExistante || lng !== lngExistante
}

export function trouverParcelleGpsProche<T extends ParcelleGps>(
  parcelles: T[],
  lat: number,
  lng: number,
  distanceMaxMetres = 25
): T | null {
  let meilleure: { parcelle: T; distance: number } | null = null
  for (const parcelle of parcelles) {
    const distance = distancePointParcelleMetres({
      lat,
      lng,
      geometryGeoJson: parcelle.geometry,
    })
    if (
      distance != null &&
      distance <= distanceMaxMetres &&
      (!meilleure || distance < meilleure.distance)
    ) {
      meilleure = { parcelle, distance }
    }
  }
  return meilleure?.parcelle ?? null
}
