/**
 * Duplication d'une parcelle de la cartographie (/jardin/carte).
 *
 * Constat vigie5388 (2026-09-18) : un compte venait de tracer huit parcelles
 * et demandait comment en dupliquer une — les tunnels d'une même ferme ont
 * le même gabarit. La carte savait dessiner, importer, éditer, déplacer et
 * supprimer une parcelle, jamais la copier : il fallait retracer chaque
 * polygone à la main.
 *
 * La copie est posée juste à l'EST de l'original, décalée de sa propre
 * largeur plus une marge, pour être visible sans le recouvrir ; l'utilisateur
 * la déplace ensuite avec l'outil existant. Une copie superposée serait
 * invisible et impossible à saisir.
 */

type Position = [number, number] // [lng, lat]

interface GeometriePolygone {
  type: "Polygon" | "MultiPolygon"
  coordinates: unknown
}

function estPosition(value: unknown): value is Position {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number" &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  )
}

/** Marge entre l'original et sa copie, en fraction de la largeur (10 %). */
export const MARGE_COPIE_PARCELLE = 0.1

/**
 * Retourne la géométrie GeoJSON (chaîne) décalée vers l'est de sa largeur
 * plus la marge, ou null si la chaîne n'est pas un Polygon/MultiPolygon
 * exploitable. Les latitudes sont conservées à l'identique.
 */
export function decalerGeometrieParcelle(geojsonStr: string, marge = MARGE_COPIE_PARCELLE): string | null {
  let geo: GeometriePolygone
  try {
    geo = JSON.parse(geojsonStr)
  } catch {
    return null
  }
  if (!geo || (geo.type !== "Polygon" && geo.type !== "MultiPolygon")) return null

  const positions: Position[] = []
  const collecter = (value: unknown): boolean => {
    if (estPosition(value)) {
      positions.push(value)
      return true
    }
    if (!Array.isArray(value)) return false
    return value.every(collecter)
  }
  if (!collecter(geo.coordinates) || positions.length === 0) return null

  const lngs = positions.map((p) => p[0])
  const largeur = Math.max(...lngs) - Math.min(...lngs)
  if (!(largeur > 0)) return null
  const dx = largeur * (1 + marge)

  const decaler = (value: unknown): unknown => {
    if (estPosition(value)) return [value[0] + dx, value[1], ...value.slice(2)]
    return Array.isArray(value) ? value.map(decaler) : value
  }

  return JSON.stringify({ ...geo, coordinates: decaler(geo.coordinates) })
}

/**
 * Nom de la copie : « Tunnel 1 (copie) », puis « (copie 2) », « (copie 3) »…
 * parmi les noms déjà pris. Une parcelle dessinée peut porter n'importe quel
 * nom, mais deux « (copie) » identiques rendraient les sélecteurs
 * indiscernables (même défaut que l'import cadastral, QA cmsp57mck).
 */
export function nomCopieParcelle(nom: string, nomsExistants: Iterable<string>): string {
  const pris = new Set(Array.from(nomsExistants, (n) => n.trim().toLowerCase()))
  const base = nom.replace(/\s*\(copie(?: \d+)?\)\s*$/i, "").trim() || "Parcelle"
  let candidat = `${base} (copie)`
  let rang = 2
  while (pris.has(candidat.toLowerCase())) {
    candidat = `${base} (copie ${rang})`
    rang += 1
  }
  return candidat
}
