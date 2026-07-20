/**
 * Helpers procéduraux purs pour la vue 3D du jardin (aucun import three).
 *
 * On transpose en 3D la logique de silhouettes par famille botanique déjà
 * utilisée en 2D (GardenView.tsx) : chaque famille a une forme « vue en
 * volume » propre. Tout est généré par code — aucun asset externe. Le jour où
 * un pack de modèles glTF existe, PLANT_SPECS est le point d'injection.
 */

/** Pseudo-aléatoire déterministe 0..1 dérivé d'une graine entière (stable). */
export function rnd(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** Mélange une couleur hex vers le blanc (amt > 0) ou le noir (amt < 0). */
export function shade(hex: string, amt: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const target = amt > 0 ? 255 : 0
  const mix = (c: number) => Math.max(0, Math.min(255, Math.round(c + (target - c) * Math.abs(amt))))
  const r = mix((n >> 16) & 255)
  const g = mix((n >> 8) & 255)
  const b = mix(n & 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`
}

export type PlantShape =
  | "buisson"          // Solanacées
  | "grandes-feuilles" // Cucurbitacées
  | "fanes"            // Apiacées
  | "dressee"          // Alliacées
  | "folioles"         // Fabacées
  | "lames"            // Poacées
  | "touffe"           // Lamiacées
  | "chou"             // Brassicacées (grosse rosette)
  | "rosette"          // défaut

const SHAPE_PAR_FAMILLE: Record<string, PlantShape> = {
  Solanaceae: "buisson",
  Cucurbitaceae: "grandes-feuilles",
  Apiaceae: "fanes",
  Alliaceae: "dressee",
  Amaryllidaceae: "dressee",
  Fabaceae: "folioles",
  Poaceae: "lames",
  Lamiaceae: "touffe",
  Brassicaceae: "chou",
}

export function shapePourFamille(familleId: string | null | undefined): PlantShape {
  return (familleId && SHAPE_PAR_FAMILLE[familleId]) || "rosette"
}

export type GeoKind = "blob" | "dome" | "cone" | "spike" | "leafy"

/**
 * Gabarit d'une plante à maturité (croissance = 1).
 * - geo : géométrie de base à instancier
 * - r   : rayon horizontal du feuillage (m)
 * - h   : hauteur (m)
 * - fruits : la plante porte des fruits colorés à l'approche de la maturité
 * - fruitR : rayon d'un fruit (m)
 */
export interface PlantSpec {
  geo: GeoKind
  r: number
  h: number
  fruits: boolean
  fruitR: number
}

const SPECS: Record<PlantShape, PlantSpec> = {
  buisson:          { geo: "blob",  r: 0.28, h: 0.55, fruits: true,  fruitR: 0.06 },
  "grandes-feuilles": { geo: "dome", r: 0.42, h: 0.30, fruits: true, fruitR: 0.11 },
  fanes:            { geo: "spike", r: 0.16, h: 0.42, fruits: false, fruitR: 0 },
  dressee:          { geo: "spike", r: 0.12, h: 0.50, fruits: false, fruitR: 0 },
  folioles:         { geo: "blob",  r: 0.24, h: 0.45, fruits: true,  fruitR: 0.05 },
  lames:            { geo: "cone",  r: 0.18, h: 0.38, fruits: false, fruitR: 0 },
  touffe:           { geo: "dome",  r: 0.20, h: 0.22, fruits: false, fruitR: 0 },
  chou:             { geo: "leafy", r: 0.26, h: 0.24, fruits: false, fruitR: 0 },
  rosette:          { geo: "leafy", r: 0.20, h: 0.14, fruits: false, fruitR: 0 },
}

export function specPourShape(shape: PlantShape): PlantSpec {
  return SPECS[shape]
}

const VERTS_FEUILLAGE = ["#4f7d2b", "#5c9134", "#436e23", "#63933a"]

/** Vert de feuillage déterministe pour une graine donnée. */
export function vertFeuillage(seed: number): string {
  return VERTS_FEUILLAGE[Math.floor(rnd(seed) * VERTS_FEUILLAGE.length)]
}

export interface PlantInstance {
  /** Position locale dans le repère de la planche (x droite, z bas), mètres. */
  x: number
  z: number
  /** Échelle horizontale et verticale (mètres, déjà multipliées par croissance). */
  r: number
  h: number
  /** Rotation aléatoire autour de l'axe vertical (rad). */
  rotY: number
}

/**
 * Répartit des plants sur une planche (repère local centré : x ∈ [-L/2, L/2]).
 * Grille alignée sur l'espacement, plafonnée pour la performance, jitter léger.
 */
export function placerPlants(
  largeur: number,
  longueur: number,
  footprint: number,
  croissance: number,
  seed: number,
  maxTotal = 80
): PlantInstance[] {
  const L = Math.max(0.2, largeur)
  const P = Math.max(0.2, longueur)
  let spacing = Math.max(0.14, footprint)
  let cols = Math.max(1, Math.floor(L / spacing))
  let rows = Math.max(1, Math.floor(P / spacing))
  // Plafond de densité : on desserre l'espacement plutôt que de couper une zone
  while (cols * rows > maxTotal) {
    spacing *= 1.15
    cols = Math.max(1, Math.floor(L / spacing))
    rows = Math.max(1, Math.floor(P / spacing))
    if (spacing > Math.max(L, P)) break
  }
  const stepX = L / cols
  const stepZ = P / rows
  // Croissance appliquée : jeunes plants réduits mais visibles
  const scaleXY = 0.45 + 0.55 * croissance
  const out: PlantInstance[] = []
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const s = seed + i * 31 + j * 7
      const jx = (rnd(s) - 0.5) * stepX * 0.35
      const jz = (rnd(s + 1) - 0.5) * stepZ * 0.35
      out.push({
        x: -L / 2 + stepX * (i + 0.5) + jx,
        z: -P / 2 + stepZ * (j + 0.5) + jz,
        r: Math.min(footprint * 0.5, spacing * 0.48) * scaleXY,
        h: 0, // hauteur remplie par l'appelant (spec.h * croissance)
        rotY: rnd(s + 2) * Math.PI * 2,
      })
    }
  }
  return out
}

/** Couleurs par défaut des objets (aligné sur la 2D). */
export const OBJET_COLORS: Record<string, string> = {
  allee: "#cbb994",
  passage: "#b7b2aa",
  bordure: "#8a6a45",
  serre: "#bcdcff",
  compost: "#5a3d1e",
  eau: "#4a90d9",
  autre: "#c9c9c9",
}

export const ARBRE_COLORS: Record<string, string> = {
  fruitier: "#3f9440",
  petit_fruit: "#c0413b",
  ornement: "#9a56c9",
  haie: "#6f9e2e",
}
