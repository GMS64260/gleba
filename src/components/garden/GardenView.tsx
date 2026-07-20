"use client"

import * as React from "react"

import { formatDistance } from "@/lib/plan-fond-utils"

export interface SelectionItem {
  type: 'planche' | 'objet' | 'arbre'
  id: string | number
}

interface PlancheWithCulture {
  id: string
  nom: string
  largeur: number | null
  longueur: number | null
  posX: number | null
  posY: number | null
  rotation2D: number | null
  ilot: string | null
  type?: string | null // Serre, Tunnel, Châssis, Plein champ… (couvert translucide)
  cultures: {
    id: number
    nbRangs: number | null
    espacement: number | null
    // Fraction de croissance à la date affichée (plan vivant) : 1 = adulte.
    croissance?: number | null
    itp: {
      espacementRangs: number | null
      espacement: number | null
    } | null
    espece: {
      id: string
      nom: string | null
      couleur: string | null
      etalement: number | null
      famille: { id?: string; couleur: string | null } | null
    }
  }[]
}

interface ObjetJardin {
  id: number
  nom: string | null
  type: string
  largeur: number
  longueur: number
  posX: number
  posY: number
  rotation2D: number
  couleur: string | null
}

interface Arbre {
  id: number
  nom: string
  type: string
  espece: string | null
  variete: string | null
  posX: number
  posY: number
  envergure: number
  // Projection adulte : cercle pointillé. Priorité au champ de l'arbre,
  // repli sur l'étalement de l'espèce du catalogue.
  envergureAdulte?: number | null
  especeEtalement?: number | null
  couleur: string | null
}

/** Diamètre adulte projeté d'un arbre (m), ou null si inconnu/inférieur à l'actuel. */
function envergureProjetee(arbre: Arbre): number | null {
  const projetee = arbre.envergureAdulte ?? arbre.especeEtalement ?? null
  return projetee && projetee > arbre.envergure ? projetee : null
}

// Couleurs par défaut pour les types d'objets
const OBJET_COLORS: Record<string, string> = {
  allee: "#d4a574",      // Marron clair (gravier)
  passage: "#a8a29e",    // Gris pierre
  bordure: "#78716c",    // Gris foncé
  serre: "#93c5fd",      // Bleu clair transparent
  compost: "#854d0e",    // Marron foncé
  eau: "#60a5fa",        // Bleu
  autre: "#d1d5db"       // Gris
}

// Couleurs par défaut pour les types d'arbres
const ARBRE_COLORS: Record<string, string> = {
  fruitier: "#22c55e",    // Vert
  petit_fruit: "#ef4444", // Rouge
  ornement: "#a855f7",    // Violet
  haie: "#84cc16"         // Vert lime
}

interface BackgroundImageSettings {
  image: string | null // Data URL ou URL
  opacity: number // 0-1
  scale: number // metres par pixel de l'image originale
  offsetX: number // decalage X en metres
  offsetY: number // decalage Y en metres
  rotation: number // rotation en degres
  // Contours de parcelle en PIXELS image : dessinés dans le même repère que
  // la photo, ils suivent calibration/décalage/rotation
  contour?: number[][][] | null
}

// ---- Rendu « organique » : helpers déterministes (stables entre renders) ----

/** Pseudo-aléatoire déterministe 0..1 dérivé d'une graine entière. */
function rnd(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** Mélange une couleur hex vers le blanc (amt > 0) ou le noir (amt < 0). */
function shade(hex: string, amt: number): string {
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

/** Id d'élément SVG sûr dérivé d'une couleur (#22c55e → 22c55e). */
const colorId = (hex: string) => hex.replace(/[^0-9a-zA-Z]/g, "")

// ---- Silhouettes végétales par famille botanique -------------------------
//
// Chaque culture est dessinée avec une silhouette « vue de dessus » propre à
// sa famille : un buisson de Solanacées ne ressemble pas à des fanes de
// carotte ni à un plant d'ail. Tout est procédural (aucun asset) ; le jour où
// un pack de sprites SVG existe, il suffira de remplacer le contenu du
// symbole <defs> correspondant — les <use> instanciés ne changent pas.

type Silhouette =
  | 'rosette'      // défaut : salades, choux, épinards…
  | 'buisson'      // Solanacées : feuillage vert + fruits colorés à maturité
  | 'grandes-feuilles' // Cucurbitacées : larges lobes + gros fruit
  | 'fanes'        // Apiacées : fanes fines plumeuses, collet coloré
  | 'dressee'      // Alliacées : tiges fines en éventail
  | 'folioles'     // Fabacées : petites folioles rondes + gousses
  | 'lames'        // Poacées : longues lames croisées
  | 'touffe'       // Lamiacées (aromatiques) : coussin dense

const SILHOUETTES_FAMILLE: Record<string, Silhouette> = {
  Solanaceae: 'buisson',
  Cucurbitaceae: 'grandes-feuilles',
  Apiaceae: 'fanes',
  Alliaceae: 'dressee',
  Amaryllidaceae: 'dressee',
  Fabaceae: 'folioles',
  Poaceae: 'lames',
  Lamiaceae: 'touffe',
}

function silhouettePour(familleId: string | null | undefined): Silhouette {
  return (familleId && SILHOUETTES_FAMILLE[familleId]) || 'rosette'
}

/** Ces silhouettes affichent des fruits/gousses quand la culture approche la maturité. */
const SILHOUETTES_A_FRUITS: Silhouette[] = ['buisson', 'grandes-feuilles', 'folioles']

const VERTS_FEUILLAGE = ['#4f7d2b', '#5c9134', '#436e23']

/**
 * Contour de couronne organique : cercle de rayon r déformé par un bruit
 * déterministe (seed) puis lissé en courbes de Bézier (Catmull-Rom).
 */
function blobPath(r: number, seed: number): string {
  const n = 9
  const pts: { x: number; y: number }[] = []
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2
    const rr = r * (0.88 + 0.22 * rnd(seed * 13 + i))
    pts.push({ x: Math.cos(angle) * rr, y: Math.sin(angle) * rr })
  }
  let d = `M ${pts[0].x.toFixed(3)} ${pts[0].y.toFixed(3)}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % n]
    const p3 = pts[(i + 2) % n]
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${c1x.toFixed(3)} ${c1y.toFixed(3)}, ${c2x.toFixed(3)} ${c2y.toFixed(3)}, ${p2.x.toFixed(3)} ${p2.y.toFixed(3)}`
  }
  return d + " Z"
}

/** Ellipse orientée vers l'extérieur, à `dist` du centre sous l'angle `deg`. */
function petale(deg: number, dist: number, rx: number, ry: number, fill: string, key?: number | string) {
  const rad = (deg * Math.PI) / 180
  const cx = Math.cos(rad) * dist
  const cy = Math.sin(rad) * dist
  return (
    <ellipse
      key={key ?? deg}
      cx={cx}
      cy={cy}
      rx={rx}
      ry={ry}
      transform={`rotate(${deg} ${cx.toFixed(3)} ${cy.toFixed(3)})`}
      fill={fill}
    />
  )
}

/**
 * Symboles <defs> d'une culture : `feuillage-<id>` (silhouette unitaire,
 * rayon ≈ 1) et, pour les familles fruitières, `fruits-<id>` superposé quand
 * la culture approche la maturité.
 */
function defsCulture(cultureId: number, silhouette: Silhouette, couleur: string, seed: number) {
  const vert = VERTS_FEUILLAGE[Math.floor(rnd(seed) * VERTS_FEUILLAGE.length)]
  const vertFonce = shade(vert, -0.22)
  const feuillageId = `feuillage-${cultureId}`
  const fruitsId = `fruits-${cultureId}`
  const strokeFruit = shade(couleur, -0.3)

  switch (silhouette) {
    case 'buisson': // Solanacées : buisson vert, fruits colorés
      return (
        <>
          <g id={feuillageId}>
            {[0, 51, 103, 154, 206, 257, 309].map(a => petale(a, 0.5, 0.58, 0.3, vert))}
            <circle r={0.4} fill={vertFonce} />
            <circle cx={-0.15} cy={-0.18} r={0.2} fill="#ffffff" opacity={0.15} />
          </g>
          <g id={fruitsId}>
            <circle cx={0.28} cy={0.12} r={0.19} fill={couleur} stroke={strokeFruit} strokeWidth={0.03} />
            <circle cx={-0.3} cy={0.22} r={0.16} fill={couleur} stroke={strokeFruit} strokeWidth={0.03} />
            <circle cx={-0.05} cy={-0.32} r={0.17} fill={couleur} stroke={strokeFruit} strokeWidth={0.03} />
          </g>
        </>
      )
    case 'grandes-feuilles': // Cucurbitacées : larges lobes, gros fruit
      return (
        <>
          <g id={feuillageId}>
            {[20, 92, 164, 236, 308].map(a => {
              const rad = (a * Math.PI) / 180
              return (
                <circle
                  key={a}
                  cx={Math.cos(rad) * 0.45}
                  cy={Math.sin(rad) * 0.45}
                  r={0.52}
                  fill={vert}
                />
              )
            })}
            <circle r={0.34} fill={vertFonce} />
            <circle cx={-0.18} cy={-0.2} r={0.22} fill="#ffffff" opacity={0.14} />
          </g>
          <g id={fruitsId}>
            <circle cx={0.3} cy={0.28} r={0.3} fill={couleur} stroke={strokeFruit} strokeWidth={0.035} />
            <circle cx={0.22} cy={0.2} r={0.09} fill="#ffffff" opacity={0.25} />
          </g>
        </>
      )
    case 'fanes': // Apiacées : fanes plumeuses, collet coloré au centre
      return (
        <g id={feuillageId}>
          {Array.from({ length: 12 }).map((_, i) =>
            petale(i * 30 + rnd(seed + i) * 12, 0.42, 0.5, 0.055, i % 2 ? vert : vertFonce, i)
          )}
          <circle r={0.16} fill={couleur} stroke={strokeFruit} strokeWidth={0.025} />
        </g>
      )
    case 'dressee': // Alliacées : tiges fines en étoile
      return (
        <g id={feuillageId}>
          {Array.from({ length: 8 }).map((_, i) =>
            petale(i * 45 + rnd(seed + i) * 16, 0.4, 0.55, 0.07, i % 2 ? couleur : shade(couleur, -0.18), i)
          )}
          <circle r={0.12} fill={shade(couleur, -0.25)} />
        </g>
      )
    case 'folioles': // Fabacées : folioles rondes, gousses à maturité
      return (
        <>
          <g id={feuillageId}>
            {Array.from({ length: 9 }).map((_, i) => {
              const rad = ((i * 40 + rnd(seed + i) * 20) * Math.PI) / 180
              const dist = i % 2 ? 0.62 : 0.32
              return (
                <circle
                  key={i}
                  cx={Math.cos(rad) * dist}
                  cy={Math.sin(rad) * dist}
                  r={0.26}
                  fill={i % 3 ? vert : vertFonce}
                />
              )
            })}
          </g>
          <g id={fruitsId}>
            {[25, 145, 265].map(a => petale(a, 0.42, 0.3, 0.075, couleur))}
          </g>
        </>
      )
    case 'lames': // Poacées : longues lames croisées
      return (
        <g id={feuillageId}>
          {[0, 45, 90, 135].map(a => petale(a, 0, 0.9, 0.09, a % 90 ? vertFonce : vert))}
          <circle r={0.13} fill={couleur} />
        </g>
      )
    case 'touffe': // Lamiacées : coussin dense
      return (
        <g id={feuillageId}>
          {Array.from({ length: 11 }).map((_, i) => {
            const rad = rnd(seed + i * 3) * Math.PI * 2
            const dist = rnd(seed + i * 7) * 0.55
            return (
              <circle
                key={i}
                cx={Math.cos(rad) * dist}
                cy={Math.sin(rad) * dist}
                r={0.3}
                fill={i % 3 === 2 ? shade(couleur, -0.18) : couleur}
              />
            )
          })}
          <circle cx={-0.12} cy={-0.15} r={0.18} fill="#ffffff" opacity={0.16} />
        </g>
      )
    default: // rosette : 6 lobes orientés vers l'extérieur + cœur éclairci
      return (
        <g id={feuillageId}>
          {[0, 60, 120, 180, 240, 300].map(a => petale(a, 0.52, 0.55, 0.38, couleur))}
          <circle r={0.45} fill={shade(couleur, 0.15)} />
          <circle cx={-0.15} cy={-0.18} r={0.22} fill="#ffffff" opacity={0.22} />
        </g>
      )
  }
}

export type GardenTool = 'select' | 'measure' | 'calibrate'

/** Calques d'affichage togglables du plan. */
export interface GardenLayers {
  fond: boolean
  grille: boolean
  etiquettes: boolean
  projectionAdulte: boolean
  associations: boolean
}

export const DEFAULT_LAYERS: GardenLayers = {
  fond: true,
  grille: true,
  etiquettes: true,
  projectionAdulte: true,
  associations: false,
}

/** Liaison d'association entre deux planches (calque « associations »). */
export interface LiaisonAssociation {
  x1: number
  y1: number
  x2: number
  y2: number
  type: 'favorable' | 'incompatible'
}

interface GardenViewProps {
  planches: PlancheWithCulture[]
  objets?: ObjetJardin[]
  arbres?: Arbre[]
  editable?: boolean
  selection?: SelectionItem[]
  onSelectionChange?: (selection: SelectionItem[]) => void
  onGroupMove?: (dx: number, dy: number) => void
  onPlancheMove?: (id: string, x: number, y: number) => void
  onObjetMove?: (id: number, x: number, y: number) => void
  onArbreMove?: (id: number, x: number, y: number) => void
  scale?: number // pixels per meter
  onScaleChange?: (scale: number) => void
  // Couleurs personnalisables
  plancheColor?: string
  selectedColor?: string
  gridColor?: string
  // Image de fond
  backgroundImage?: BackgroundImageSettings
  // Outil actif : 'measure' = règle 2 points, 'calibrate' = calibration du fond
  tool?: GardenTool
  // Calibration : appelé avec les 2 points cliqués (coordonnées monde, mètres)
  onCalibrate?: (p1: { x: number; y: number }, p2: { x: number; y: number }) => void
  // Calques togglables (fond, grille, étiquettes, projection adulte, associations)
  layers?: Partial<GardenLayers>
  // Liaisons d'association entre planches (rendues si layers.associations)
  liaisons?: LiaisonAssociation[]
}

export function GardenView({
  planches,
  objets = [],
  arbres = [],
  editable = false,
  selection = [],
  onSelectionChange,
  onGroupMove,
  onPlancheMove,
  onObjetMove,
  onArbreMove,
  scale = 50,
  onScaleChange,
  plancheColor = "#8B5A2B",
  gridColor = "#e5e7eb",
  backgroundImage,
  tool = 'select',
  onCalibrate,
  layers,
  liaisons,
}: GardenViewProps) {
  const calques: GardenLayers = { ...DEFAULT_LAYERS, ...layers }
  const svgRef = React.useRef<SVGSVGElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = React.useState<{ type: 'planche' | 'objet' | 'arbre'; id: string | number } | null>(null)
  const [groupDrag, setGroupDrag] = React.useState<{ startX: number; startY: number; lastX: number; lastY: number } | null>(null)
  const [marquee, setMarquee] = React.useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null)
  const [offset, setOffset] = React.useState({ x: 0, y: 0 })
  const [hasMoved, setHasMoved] = React.useState(false)
  const [viewBox, setViewBox] = React.useState({ x: -1, y: -1, w: 20, h: 15 })
  const [bgImageSize, setBgImageSize] = React.useState<{ width: number; height: number } | null>(null)
  const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 })
  const activePointers = React.useRef(new Map<number, { x: number; y: number }>())
  const pinchStart = React.useRef<{ distance: number; scale: number } | null>(null)

  // Outils mesure/calibration : points cliqués (monde, mètres) + survol live.
  // Le point n'est posé qu'au pointerup si le doigt/curseur n'a pas bougé,
  // pour ne pas parasiter le pinch-zoom à deux doigts.
  const toolActive = tool !== 'select'
  const [toolPoints, setToolPoints] = React.useState<{ x: number; y: number }[]>([])
  const [toolHover, setToolHover] = React.useState<{ x: number; y: number } | null>(null)
  const toolDown = React.useRef<{ clientX: number; clientY: number } | null>(null)

  React.useEffect(() => {
    // Changement d'outil → repartir de zéro
    setToolPoints([])
    setToolHover(null)
    toolDown.current = null
  }, [tool])

  // Memoized selection sets for O(1) lookup
  const selectedPlanches = React.useMemo(() => new Set(
    selection.filter(s => s.type === 'planche').map(s => s.id as string)
  ), [selection])
  const selectedObjets = React.useMemo(() => new Set(
    selection.filter(s => s.type === 'objet').map(s => s.id as number)
  ), [selection])
  const selectedArbres = React.useMemo(() => new Set(
    selection.filter(s => s.type === 'arbre').map(s => s.id as number)
  ), [selection])

  // Convert client coordinates to SVG coordinates
  const clientToSvg = React.useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return null
    const pt = svg.createSVGPoint()
    pt.x = clientX
    pt.y = clientY
    const ctm = svg.getScreenCTM()
    if (!ctm) return null
    return pt.matrixTransform(ctm.inverse())
  }, [])

  // Observer la taille du conteneur parent (pas le SVG)
  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return
    // Mesurer immédiatement
    setContainerSize({ width: el.clientWidth, height: el.clientHeight })
    const ro = new ResizeObserver(() => {
      setContainerSize({ width: el.clientWidth, height: el.clientHeight })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Charger les dimensions de l'image de fond
  React.useEffect(() => {
    if (!backgroundImage?.image) {
      setBgImageSize(null)
      return
    }
    const img = new Image()
    img.onload = () => {
      setBgImageSize({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.src = backgroundImage.image
  }, [backgroundImage?.image])

  // Calculer la taille du jardin basée sur les planches, objets, arbres ET image de fond
  React.useEffect(() => {
    // Audit 2026-07 (#25) : ne PAS recalculer le viewBox pendant un drag. Le
    // mapping écran→SVG (getScreenCTM) dépend du viewBox ; le recalculer à
    // chaque mousemove décalait la conversion, faisant « fuir » l'élément
    // déplacé vers des coordonnées de plus en plus négatives. Le viewBox est
    // figé le temps du drag puis réajusté à la fin (dragging → null).
    if (dragging) return

    // Inclure l'image de fond meme s'il n'y a pas d'elements
    const hasElements = planches.length > 0 || objets.length > 0 || arbres.length > 0
    const hasBackground = backgroundImage?.image && bgImageSize

    if (!hasElements && !hasBackground) return

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

    // Inclure l'image de fond dans les bounds
    if (hasBackground && bgImageSize) {
      const imgX = backgroundImage.offsetX
      const imgY = backgroundImage.offsetY
      const imgW = bgImageSize.width * backgroundImage.scale
      const imgH = bgImageSize.height * backgroundImage.scale

      minX = Math.min(minX, imgX)
      minY = Math.min(minY, imgY)
      maxX = Math.max(maxX, imgX + imgW)
      maxY = Math.max(maxY, imgY + imgH)
    }

    planches.forEach(p => {
      const x = p.posX ?? 0
      const y = p.posY ?? 0
      const w = p.largeur ?? 1
      const l = p.longueur ?? 1

      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x + w)
      maxY = Math.max(maxY, y + l)
    })

    objets.forEach(o => {
      minX = Math.min(minX, o.posX)
      minY = Math.min(minY, o.posY)
      maxX = Math.max(maxX, o.posX + o.largeur)
      maxY = Math.max(maxY, o.posY + o.longueur)
    })

    arbres.forEach(a => {
      // Inclure la projection adulte (cercle pointillé) dans le cadrage
      const r = Math.max(a.envergure, envergureProjetee(a) ?? 0) / 2
      minX = Math.min(minX, a.posX - r)
      minY = Math.min(minY, a.posY - r)
      maxX = Math.max(maxX, a.posX + r)
      maxY = Math.max(maxY, a.posY + r)
    })

    // Si aucune bound trouvee, utiliser des valeurs par defaut
    if (minX === Infinity) minX = 0
    if (minY === Infinity) minY = 0
    if (maxX === -Infinity) maxX = 10
    if (maxY === -Infinity) maxY = 8

    // Ajouter une marge
    const margin = 1
    setViewBox({
      x: Math.min(minX - margin, -1),
      y: Math.min(minY - margin, -1),
      w: Math.max(maxX - minX + margin * 2, 10),
      h: Math.max(maxY - minY + margin * 2, 8)
    })
  }, [planches, objets, arbres, backgroundImage, bgImageSize, dragging])

  // Check if an item is in the current selection
  const isItemSelected = React.useCallback((type: SelectionItem['type'], id: string | number) => {
    if (type === 'planche') return selectedPlanches.has(id as string)
    if (type === 'objet') return selectedObjets.has(id as number)
    return selectedArbres.has(id as number)
  }, [selectedPlanches, selectedObjets, selectedArbres])

  // Hit-test: find all items whose bounding box intersects the given rect
  const computeItemsInRect = React.useCallback((x1: number, y1: number, x2: number, y2: number): SelectionItem[] => {
    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2)
    const minY = Math.min(y1, y2), maxY = Math.max(y1, y2)
    const items: SelectionItem[] = []

    planches.forEach(p => {
      const px = p.posX ?? 0, py = p.posY ?? 0
      const pw = p.largeur ?? 0.8, pl = p.longueur ?? 2
      if (px + pw > minX && px < maxX && py + pl > minY && py < maxY) {
        items.push({ type: 'planche', id: p.id })
      }
    })

    objets.forEach(o => {
      if (o.posX + o.largeur > minX && o.posX < maxX && o.posY + o.longueur > minY && o.posY < maxY) {
        items.push({ type: 'objet', id: o.id })
      }
    })

    arbres.forEach(a => {
      const r = a.envergure / 2
      if (a.posX + r > minX && a.posX - r < maxX && a.posY + r > minY && a.posY - r < maxY) {
        items.push({ type: 'arbre', id: a.id })
      }
    })

    return items
  }, [planches, objets, arbres])

  const registerPointer = (e: React.PointerEvent) => {
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    svgRef.current?.setPointerCapture?.(e.pointerId)
    if (activePointers.current.size === 2) {
      const [a, b] = Array.from(activePointers.current.values())
      pinchStart.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), scale }
      setDragging(null)
      setGroupDrag(null)
      setMarquee(null)
    }
  }

  const handleItemPointerDown = (e: React.PointerEvent, type: SelectionItem['type'], id: string | number) => {
    // Outil actif : le clic sur un élément pose un point comme sur le fond
    // (l'événement remonte jusqu'au SVG qui gère l'outil).
    if (toolActive) return

    registerPointer(e)
    if (activePointers.current.size > 1) return
    if (!editable) {
      // Non-edit mode: simple click select
      onSelectionChange?.([{ type, id }])
      return
    }

    e.stopPropagation()
    setHasMoved(false)

    const svgP = clientToSvg(e.clientX, e.clientY)
    if (!svgP) return

    // Shift+click: toggle in selection
    if (e.shiftKey) {
      const alreadySelected = isItemSelected(type, id)
      if (alreadySelected) {
        onSelectionChange?.(selection.filter(s => !(s.type === type && s.id === id)))
      } else {
        onSelectionChange?.([...selection, { type, id }])
      }
      return
    }

    const alreadySelected = isItemSelected(type, id)

    if (alreadySelected && selection.length > 1) {
      // Start group drag
      setGroupDrag({ startX: svgP.x, startY: svgP.y, lastX: svgP.x, lastY: svgP.y })
    } else {
      // Select only this item and start single drag
      if (!alreadySelected) {
        onSelectionChange?.([{ type, id }])
      }

      // Compute offset for single drag
      if (type === 'planche') {
        const planche = planches.find(p => p.id === id)
        if (planche) setOffset({ x: svgP.x - (planche.posX ?? 0), y: svgP.y - (planche.posY ?? 0) })
      } else if (type === 'objet') {
        const objet = objets.find(o => o.id === id)
        if (objet) setOffset({ x: svgP.x - objet.posX, y: svgP.y - objet.posY })
      } else {
        const arbre = arbres.find(a => a.id === id)
        if (arbre) setOffset({ x: svgP.x - arbre.posX, y: svgP.y - arbre.posY })
      }
      setDragging({ type, id })
    }
  }

  // Mouse down on SVG background: start marquee
  const handleSvgPointerDown = (e: React.PointerEvent) => {
    registerPointer(e)
    if (activePointers.current.size > 1) {
      toolDown.current = null
      return
    }
    if (toolActive) {
      // Le point sera posé au pointerup si le pointeur n'a pas bougé (clic)
      toolDown.current = { clientX: e.clientX, clientY: e.clientY }
      return
    }
    if (!editable) return
    // Only react to background clicks (not bubbled from items)
    if (e.target !== svgRef.current && !(e.target as Element)?.closest?.('rect[data-bg]')) return

    const svgP = clientToSvg(e.clientX, e.clientY)
    if (!svgP) return

    setHasMoved(false)
    setMarquee({ startX: svgP.x, startY: svgP.y, currentX: svgP.x, currentY: svgP.y })
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (activePointers.current.has(e.pointerId)) {
      activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    }

    if (activePointers.current.size >= 2 && pinchStart.current && onScaleChange) {
      e.preventDefault()
      const [a, b] = Array.from(activePointers.current.values())
      const distance = Math.hypot(a.x - b.x, a.y - b.y)
      const nextScale = Math.min(120, Math.max(6, pinchStart.current.scale * distance / pinchStart.current.distance))
      onScaleChange(Math.round(nextScale))
      return
    }

    if (toolActive) {
      const svgP = clientToSvg(e.clientX, e.clientY)
      if (svgP && activePointers.current.size <= 1) setToolHover({ x: svgP.x, y: svgP.y })
      return
    }

    if (!editable) return

    const svgP = clientToSvg(e.clientX, e.clientY)
    if (!svgP) return

    // Marquee mode
    if (marquee) {
      setHasMoved(true)
      setMarquee(prev => prev ? { ...prev, currentX: svgP.x, currentY: svgP.y } : null)
      return
    }

    // Group drag mode
    if (groupDrag) {
      setHasMoved(true)
      const snapGrid = 10
      const dx = Math.round((svgP.x - groupDrag.lastX) * snapGrid) / snapGrid
      const dy = Math.round((svgP.y - groupDrag.lastY) * snapGrid) / snapGrid
      if (dx !== 0 || dy !== 0) {
        onGroupMove?.(dx, dy)
        setGroupDrag(prev => prev ? { ...prev, lastX: prev.lastX + dx, lastY: prev.lastY + dy } : null)
      }
      return
    }

    // Single drag mode
    if (dragging) {
      const snapGrid = 10
      const newX = Math.round((svgP.x - offset.x) * snapGrid) / snapGrid
      const newY = Math.round((svgP.y - offset.y) * snapGrid) / snapGrid

      // Feedback Marc 2026-05-16 — Bug 05 : un simple clic sur un arbre
      // déclenchait une sauvegarde alors qu'aucun déplacement n'avait
      // eu lieu. Cause : tout léger frémissement souris fait passer en
      // mode drag, et `onArbreMove` est appelé avec une position
      // identique (après snap) → setHasChanges(true) → toast "Plan
      // sauvegardé". On ne propage le déplacement QUE si la nouvelle
      // position (snap inclus) diffère de l'actuelle.
      let currentX = 0
      let currentY = 0
      if (dragging.type === 'planche') {
        const p = planches.find(p => p.id === dragging.id)
        currentX = p?.posX ?? 0
        currentY = p?.posY ?? 0
      } else if (dragging.type === 'objet') {
        const o = objets.find(o => o.id === dragging.id)
        currentX = o?.posX ?? 0
        currentY = o?.posY ?? 0
      } else if (dragging.type === 'arbre') {
        const a = arbres.find(a => a.id === dragging.id)
        currentX = a?.posX ?? 0
        currentY = a?.posY ?? 0
      }

      if (newX === currentX && newY === currentY) return

      setHasMoved(true)
      if (dragging.type === 'planche') {
        onPlancheMove?.(dragging.id as string, newX, newY)
      } else if (dragging.type === 'objet') {
        onObjetMove?.(dragging.id as number, newX, newY)
      } else if (dragging.type === 'arbre') {
        onArbreMove?.(dragging.id as number, newX, newY)
      }
    }
  }

  const finishInteraction = () => {
    // Marquee release: select items in rect
    if (marquee) {
      if (hasMoved) {
        const items = computeItemsInRect(marquee.startX, marquee.startY, marquee.currentX, marquee.currentY)
        onSelectionChange?.(items)
      } else {
        // Click on background without moving = deselect all
        onSelectionChange?.([])
      }
      setMarquee(null)
      setHasMoved(false)
      return
    }

    // Group drag release
    if (groupDrag) {
      setGroupDrag(null)
      setHasMoved(false)
      return
    }

    // Single drag release: if didn't move, it was a click → select the item
    if (dragging && !hasMoved) {
      onSelectionChange?.([{ type: dragging.type, id: dragging.id }])
    }
    setDragging(null)
    setHasMoved(false)
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    activePointers.current.delete(e.pointerId)
    if (activePointers.current.size < 2) pinchStart.current = null

    if (toolActive) {
      const down = toolDown.current
      toolDown.current = null
      if (down && activePointers.current.size === 0) {
        const moved = Math.hypot(e.clientX - down.clientX, e.clientY - down.clientY)
        if (moved < 8) {
          const svgP = clientToSvg(e.clientX, e.clientY)
          if (svgP) {
            const point = { x: svgP.x, y: svgP.y }
            setToolPoints(prev => {
              if (tool === 'calibrate' && prev.length === 1) {
                onCalibrate?.(prev[0], point)
                return []
              }
              // Mesure : un 3e clic démarre une nouvelle mesure
              return prev.length >= 2 ? [point] : [...prev, point]
            })
          }
        }
      }
      return
    }

    if (activePointers.current.size === 0) finishInteraction()
  }

  const handleSvgClick = (e: React.MouseEvent) => {
    // In non-edit mode, click on background = deselect
    if (!editable && (e.target === svgRef.current || (e.target as Element)?.closest?.('rect[data-bg]'))) {
      onSelectionChange?.([])
    }
  }

  // Dimensions en pixels : au minimum la taille du conteneur
  const svgWidth = Math.max(viewBox.w * scale, containerSize.width)
  const svgHeight = Math.max(viewBox.h * scale, containerSize.height)

  // ViewBox effectif : couvre le contenu ET remplit le conteneur
  const effectiveViewBox = React.useMemo(() => {
    return {
      x: viewBox.x,
      y: viewBox.y,
      w: svgWidth / scale,
      h: svgHeight / scale,
    }
  }, [viewBox, svgWidth, svgHeight, scale])

  // Générer les lignes de grille basées sur le viewBox effectif
  const gridLines = React.useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number; type: 'small' | 'medium' | 'large' }[] = []

    // Arrondir aux mètres pour aligner la grille
    const startX = Math.floor(effectiveViewBox.x)
    const endX = Math.ceil(effectiveViewBox.x + effectiveViewBox.w)
    const startY = Math.floor(effectiveViewBox.y)
    const endY = Math.ceil(effectiveViewBox.y + effectiveViewBox.h)

    // Lignes verticales
    for (let x = startX; x <= endX; x += 0.5) {
      const type = x % 5 === 0 ? 'large' : x % 1 === 0 ? 'medium' : 'small'
      lines.push({ x1: x, y1: startY, x2: x, y2: endY, type })
    }

    // Lignes horizontales
    for (let y = startY; y <= endY; y += 0.5) {
      const type = y % 5 === 0 ? 'large' : y % 1 === 0 ? 'medium' : 'small'
      lines.push({ x1: startX, y1: y, x2: endX, y2: y, type })
    }

    return lines
  }, [effectiveViewBox])

  return (
    <div ref={containerRef} className="h-full w-full relative">
      <div className="absolute inset-0 overflow-auto">
      <svg
        ref={svgRef}
        width={svgWidth}
        height={svgHeight}
        viewBox={`${effectiveViewBox.x} ${effectiveViewBox.y} ${effectiveViewBox.w} ${effectiveViewBox.h}`}
        className={toolActive || editable ? "cursor-crosshair touch-none select-none" : "touch-pan-x touch-pan-y"}
        onPointerDown={handleSvgPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleSvgClick}
      >
        <defs>
          <linearGradient id="garden-background" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f4f8ee" />
            <stop offset="100%" stopColor="#e7f2dc" />
          </linearGradient>
          <filter id="garden-soft-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0.05" dy="0.08" stdDeviation="0.06" floodColor="#365314" floodOpacity="0.22" />
          </filter>

          {/* Textures procédurales, en unités monde (mètres) : elles se
              superposent en transparence à la couleur de base de l'élément,
              donc restent compatibles avec les couleurs personnalisées. */}
          <pattern id="tex-grass" patternUnits="userSpaceOnUse" width="0.9" height="0.9">
            <path d="M0.12 0.22 l0.025 -0.075 M0.155 0.22 l0.012 -0.055 M0.09 0.22 l-0.012 -0.05" stroke="#4d7c0f" strokeWidth="0.011" opacity="0.14" fill="none" strokeLinecap="round" />
            <path d="M0.62 0.5 l0.025 -0.07 M0.655 0.5 l0.01 -0.05 M0.59 0.5 l-0.014 -0.048" stroke="#4d7c0f" strokeWidth="0.011" opacity="0.12" fill="none" strokeLinecap="round" />
            <path d="M0.3 0.78 l0.022 -0.065 M0.33 0.78 l0.008 -0.045 M0.272 0.78 l-0.013 -0.045" stroke="#3f6212" strokeWidth="0.011" opacity="0.13" fill="none" strokeLinecap="round" />
            <path d="M0.8 0.16 l0.02 -0.06 M0.828 0.16 l0.008 -0.042" stroke="#65a30d" strokeWidth="0.01" opacity="0.11" fill="none" strokeLinecap="round" />
            <circle cx="0.45" cy="0.35" r="0.012" fill="#365314" opacity="0.05" />
            <circle cx="0.08" cy="0.62" r="0.01" fill="#365314" opacity="0.05" />
          </pattern>

          <pattern id="tex-soil" patternUnits="userSpaceOnUse" width="0.5" height="0.5">
            <circle cx="0.08" cy="0.11" r="0.022" fill="#000000" opacity="0.12" />
            <circle cx="0.3" cy="0.05" r="0.016" fill="#000000" opacity="0.1" />
            <circle cx="0.42" cy="0.2" r="0.02" fill="#000000" opacity="0.13" />
            <circle cx="0.18" cy="0.32" r="0.025" fill="#000000" opacity="0.09" />
            <circle cx="0.36" cy="0.42" r="0.018" fill="#000000" opacity="0.12" />
            <circle cx="0.48" cy="0.08" r="0.014" fill="#000000" opacity="0.1" />
            <circle cx="0.06" cy="0.44" r="0.015" fill="#ffffff" opacity="0.07" />
            <circle cx="0.25" cy="0.18" r="0.014" fill="#ffffff" opacity="0.08" />
            <circle cx="0.47" cy="0.34" r="0.013" fill="#ffffff" opacity="0.06" />
            <circle cx="0.14" cy="0.47" r="0.012" fill="#ffffff" opacity="0.06" />
          </pattern>

          <pattern id="tex-gravel" patternUnits="userSpaceOnUse" width="0.35" height="0.35">
            <ellipse cx="0.06" cy="0.08" rx="0.028" ry="0.02" fill="#57534e" opacity="0.35" />
            <ellipse cx="0.2" cy="0.05" rx="0.024" ry="0.018" fill="#fafaf9" opacity="0.4" />
            <ellipse cx="0.3" cy="0.13" rx="0.026" ry="0.02" fill="#78716c" opacity="0.35" />
            <ellipse cx="0.12" cy="0.2" rx="0.03" ry="0.022" fill="#e7e5e4" opacity="0.45" />
            <ellipse cx="0.27" cy="0.27" rx="0.025" ry="0.019" fill="#44403c" opacity="0.3" />
            <ellipse cx="0.05" cy="0.31" rx="0.022" ry="0.017" fill="#d6d3d1" opacity="0.4" />
            <ellipse cx="0.19" cy="0.33" rx="0.02" ry="0.015" fill="#a8a29e" opacity="0.35" />
            <ellipse cx="0.33" cy="0.02" rx="0.02" ry="0.015" fill="#d6d3d1" opacity="0.35" />
          </pattern>

          <pattern id="tex-wood" patternUnits="userSpaceOnUse" width="0.6" height="0.6">
            <path d="M0 0.1 Q 0.15 0.075 0.3 0.1 T 0.6 0.1" stroke="#000000" strokeWidth="0.008" opacity="0.18" fill="none" />
            <path d="M0 0.24 Q 0.2 0.27 0.4 0.24 T 0.6 0.245" stroke="#000000" strokeWidth="0.008" opacity="0.15" fill="none" />
            <path d="M0 0.4 Q 0.12 0.375 0.3 0.4 T 0.6 0.4" stroke="#000000" strokeWidth="0.008" opacity="0.17" fill="none" />
            <path d="M0 0.53 Q 0.22 0.555 0.42 0.53 T 0.6 0.535" stroke="#000000" strokeWidth="0.008" opacity="0.14" fill="none" />
            <circle cx="0.45" cy="0.32" r="0.02" fill="none" stroke="#000000" strokeWidth="0.008" opacity="0.15" />
          </pattern>

          <pattern id="tex-compost" patternUnits="userSpaceOnUse" width="0.4" height="0.4">
            <circle cx="0.07" cy="0.09" r="0.03" fill="#451a03" opacity="0.3" />
            <circle cx="0.25" cy="0.06" r="0.025" fill="#1c1917" opacity="0.25" />
            <circle cx="0.34" cy="0.18" r="0.028" fill="#451a03" opacity="0.28" />
            <circle cx="0.14" cy="0.24" r="0.026" fill="#292524" opacity="0.25" />
            <path d="M0.2 0.32 l0.06 -0.02" stroke="#eab308" strokeWidth="0.012" opacity="0.25" strokeLinecap="round" />
            <path d="M0.05 0.35 l0.05 0.015" stroke="#ca8a04" strokeWidth="0.01" opacity="0.22" strokeLinecap="round" />
            <circle cx="0.31" cy="0.33" r="0.02" fill="#78350f" opacity="0.3" />
          </pattern>

          <radialGradient id="grad-eau" cx="0.4" cy="0.35" r="0.8">
            <stop offset="0%" stopColor="#bfdbfe" />
            <stop offset="60%" stopColor="#7cb8f7" />
            <stop offset="100%" stopColor="#3b82f6" />
          </radialGradient>

          {/* Dégradés de couronne : un par couleur d'arbre présente sur le plan */}
          {[...new Set(arbres.map(a => a.couleur || ARBRE_COLORS[a.type] || ARBRE_COLORS.fruitier))].map(c => (
            <radialGradient key={c} id={`grad-arbre-${colorId(c)}`} cx="0.38" cy="0.35" r="0.75">
              <stop offset="0%" stopColor={shade(c, 0.28)} />
              <stop offset="65%" stopColor={c} />
              <stop offset="100%" stopColor={shade(c, -0.18)} />
            </radialGradient>
          ))}
        </defs>

        {/* Fond */}
        <rect
          data-bg="true"
          x={effectiveViewBox.x}
          y={effectiveViewBox.y}
          width={effectiveViewBox.w}
          height={effectiveViewBox.h}
          fill="url(#garden-background)"
        />
        {/* Touffes d'herbe discrètes (sous l'éventuelle image satellite) */}
        <rect
          x={effectiveViewBox.x}
          y={effectiveViewBox.y}
          width={effectiveViewBox.w}
          height={effectiveViewBox.h}
          fill="url(#tex-grass)"
          style={{ pointerEvents: "none" }}
        />

        {/* Image de fond (satellite) */}
        {calques.fond && backgroundImage?.image && bgImageSize && (
          <g
            transform={`
              translate(${backgroundImage.offsetX}, ${backgroundImage.offsetY})
              rotate(${backgroundImage.rotation}, ${(bgImageSize.width * backgroundImage.scale) / 2}, ${(bgImageSize.height * backgroundImage.scale) / 2})
            `}
            style={{ pointerEvents: "none" }}
          >
            <image
              href={backgroundImage.image}
              x={0}
              y={0}
              width={bgImageSize.width * backgroundImage.scale}
              height={bgImageSize.height * backgroundImage.scale}
              opacity={backgroundImage.opacity}
              preserveAspectRatio="none"
            />
            {/* Contour de la parcelle (px image × échelle → mètres). Trait à
                épaisseur constante à l'écran + liseré blanc pour rester
                lisible sur la photo à tous les niveaux de zoom. */}
            {backgroundImage.contour?.map((ring, i) => {
              const points = ring
                .map(
                  ([px, py]) =>
                    `${(px * backgroundImage.scale).toFixed(3)},${(py * backgroundImage.scale).toFixed(3)}`
                )
                .join(" ")
              return (
                <g key={i}>
                  <polygon
                    points={points}
                    fill="#22c55e"
                    fillOpacity={0.06}
                    stroke="#ffffff"
                    strokeWidth={5 / scale}
                    strokeLinejoin="round"
                    opacity={0.9}
                  />
                  <polygon
                    points={points}
                    fill="none"
                    stroke="#16a34a"
                    strokeWidth={2.5 / scale}
                    strokeDasharray={`${8 / scale} ${5 / scale}`}
                    strokeLinejoin="round"
                  />
                </g>
              )
            })}
          </g>
        )}

        {/* Grille de fond - lignes réelles */}
        {calques.grille && <g className="grid-lines">
          {gridLines.map((line, i) => (
            <line
              key={i}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={gridColor}
              opacity={line.type === 'large' ? 0.32 : line.type === 'medium' ? 0.14 : 0.06}
              strokeWidth={
                line.type === 'large' ? 0.04 :
                line.type === 'medium' ? 0.02 : 0.01
              }
            />
          ))}
        </g>}

        {/* Objets de jardin (rendus en premier, sous les planches) */}
        {objets.map((objet) => {
          const color = objet.couleur || OBJET_COLORS[objet.type] || OBJET_COLORS.autre
          const isSelected = selectedObjets.has(objet.id)
          const isDraggingThis = dragging?.type === 'objet' && dragging.id === objet.id

          return (
            <g
              key={`objet-${objet.id}`}
              transform={`translate(${objet.posX}, ${objet.posY}) rotate(${objet.rotation2D}, ${objet.largeur/2}, ${objet.longueur/2})`}
              onPointerDown={(e) => handleItemPointerDown(e, 'objet', objet.id)}
              filter="url(#garden-soft-shadow)"
              style={{ cursor: editable ? (isDraggingThis ? "grabbing" : "grab") : "pointer" }}
            >
              {/* Forme selon le type */}
              {objet.type === 'allee' || objet.type === 'passage' ? (
                // Allée/passage: gravier
                <>
                  <rect
                    x={0}
                    y={0}
                    width={objet.largeur}
                    height={objet.longueur}
                    fill={color}
                    stroke={isSelected ? "#3b82f6" : "#a8a29e"}
                    strokeWidth={isSelected ? 0.08 : 0.02}
                    strokeDasharray={objet.type === 'passage' ? "0.1 0.05" : undefined}
                  />
                  <rect
                    x={0}
                    y={0}
                    width={objet.largeur}
                    height={objet.longueur}
                    fill="url(#tex-gravel)"
                    style={{ pointerEvents: "none" }}
                  />
                </>
              ) : objet.type === 'bordure' ? (
                // Bordure: bois (veinage)
                <>
                  <rect
                    x={0}
                    y={0}
                    width={objet.largeur}
                    height={objet.longueur}
                    fill={color}
                    stroke={isSelected ? "#3b82f6" : "#57534e"}
                    strokeWidth={isSelected ? 0.08 : 0.04}
                  />
                  <rect
                    x={0}
                    y={0}
                    width={objet.largeur}
                    height={objet.longueur}
                    fill="url(#tex-wood)"
                    style={{ pointerEvents: "none" }}
                  />
                </>
              ) : objet.type === 'serre' ? (
                // Serre: forme semi-transparente
                <>
                  <rect
                    x={0}
                    y={0}
                    width={objet.largeur}
                    height={objet.longueur}
                    fill={color}
                    fillOpacity={0.3}
                    stroke={isSelected ? "#3b82f6" : "#60a5fa"}
                    strokeWidth={isSelected ? 0.08 : 0.04}
                    rx={0.1}
                  />
                  {/* Arceaux */}
                  {Array.from({ length: Math.floor(objet.longueur / 0.5) }).map((_, i) => (
                    <line
                      key={i}
                      x1={0}
                      y1={(i + 0.5) * 0.5}
                      x2={objet.largeur}
                      y2={(i + 0.5) * 0.5}
                      stroke="#93c5fd"
                      strokeWidth={0.02}
                      style={{ pointerEvents: "none" }}
                    />
                  ))}
                </>
              ) : objet.type === 'eau' ? (
                // Point d'eau: dégradé profondeur + reflets
                <>
                  <ellipse
                    cx={objet.largeur / 2}
                    cy={objet.longueur / 2}
                    rx={objet.largeur / 2}
                    ry={objet.longueur / 2}
                    fill={objet.couleur ? color : "url(#grad-eau)"}
                    fillOpacity={objet.couleur ? 0.6 : 1}
                    stroke={isSelected ? "#3b82f6" : "#2563eb"}
                    strokeWidth={isSelected ? 0.08 : 0.03}
                  />
                  <ellipse
                    cx={objet.largeur / 2}
                    cy={objet.longueur / 2}
                    rx={objet.largeur * 0.32}
                    ry={objet.longueur * 0.32}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth={0.018}
                    opacity={0.35}
                    style={{ pointerEvents: "none" }}
                  />
                  <ellipse
                    cx={objet.largeur / 2}
                    cy={objet.longueur / 2}
                    rx={objet.largeur * 0.16}
                    ry={objet.longueur * 0.16}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth={0.015}
                    opacity={0.3}
                    style={{ pointerEvents: "none" }}
                  />
                </>
              ) : (
                // Autres objets: rectangle (texture compost le cas échéant)
                <>
                  <rect
                    x={0}
                    y={0}
                    width={objet.largeur}
                    height={objet.longueur}
                    fill={color}
                    stroke={isSelected ? "#3b82f6" : "#6b7280"}
                    strokeWidth={isSelected ? 0.08 : 0.03}
                    rx={0.05}
                  />
                  {objet.type === 'compost' && (
                    <rect
                      x={0}
                      y={0}
                      width={objet.largeur}
                      height={objet.longueur}
                      fill="url(#tex-compost)"
                      rx={0.05}
                      style={{ pointerEvents: "none" }}
                    />
                  )}
                </>
              )}
              {/* Halo de selection */}
              {isSelected && (
                <rect
                  x={-0.05}
                  y={-0.05}
                  width={objet.largeur + 0.1}
                  height={objet.longueur + 0.1}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth={0.05}
                  strokeDasharray="0.2 0.1"
                  rx={0.08}
                />
              )}
              {/* Nom si présent */}
              {calques.etiquettes && objet.nom && (
                <text
                  x={objet.largeur / 2}
                  y={objet.longueur / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={Math.min(objet.largeur * 0.3, objet.longueur * 0.15, 0.3)}
                  fill="#374151"
                  fontWeight="500"
                  style={{ pointerEvents: "none" }}
                >
                  {objet.nom}
                </text>
              )}
            </g>
          )
        })}

        {/* Arbres et arbustes */}
        {arbres.map((arbre) => {
          const color = arbre.couleur || ARBRE_COLORS[arbre.type] || ARBRE_COLORS.fruitier
          const isSelected = selectedArbres.has(arbre.id)
          const isDraggingThis = dragging?.type === 'arbre' && dragging.id === arbre.id
          const r = arbre.envergure / 2
          const projetee = calques.projectionAdulte ? envergureProjetee(arbre) : null
          const rAdulte = projetee ? projetee / 2 : null
          // Couronne organique déterministe (stable d'un render à l'autre)
          const couronne = blobPath(r, arbre.id + 1)
          const feuillageInterne = blobPath(r * 0.55, arbre.id + 40)

          return (
            <g
              key={`arbre-${arbre.id}`}
              transform={`translate(${arbre.posX}, ${arbre.posY})`}
              onPointerDown={(e) => handleItemPointerDown(e, 'arbre', arbre.id)}
              filter="url(#garden-soft-shadow)"
              style={{ cursor: editable ? (isDraggingThis ? "grabbing" : "grab") : "pointer" }}
            >
              {/* Projection de la couronne adulte (pointillés) */}
              {rAdulte && (
                <circle
                  cx={0}
                  cy={0}
                  r={rAdulte}
                  fill={color}
                  fillOpacity={0.06}
                  stroke={color}
                  strokeWidth={0.04}
                  strokeDasharray="0.18 0.12"
                  strokeOpacity={0.8}
                  style={{ pointerEvents: "none" }}
                />
              )}
              {/* Ombre portée de la couronne */}
              <path
                d={couronne}
                transform="translate(0.07, 0.09)"
                fill="rgba(0,0,0,0.17)"
              />
              {/* Couronne organique en dégradé */}
              <path
                d={couronne}
                fill={`url(#grad-arbre-${colorId(color)})`}
                stroke={isSelected ? "#3b82f6" : isDraggingThis ? "#60a5fa" : shade(color, -0.4)}
                strokeWidth={isSelected ? 0.1 : isDraggingThis ? 0.08 : 0.03}
              />
              {/* Masses de feuillage internes */}
              <path
                d={feuillageInterne}
                transform={`translate(${r * 0.18}, ${r * 0.2})`}
                fill={shade(color, -0.14)}
                opacity={0.35}
                style={{ pointerEvents: "none" }}
              />
              <path
                d={blobPath(r * 0.4, arbre.id + 77)}
                transform={`translate(${-r * 0.25}, ${-r * 0.22})`}
                fill={shade(color, 0.2)}
                opacity={0.4}
                style={{ pointerEvents: "none" }}
              />
              {/* Point central (tronc) */}
              <circle
                cx={0}
                cy={0}
                r={Math.min(0.1, r * 0.18)}
                fill="#78350f"
                style={{ pointerEvents: "none" }}
              />
              {/* Halo de selection */}
              {isSelected && (
                <circle
                  cx={0}
                  cy={0}
                  r={r + 0.1}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth={0.05}
                  strokeDasharray="0.2 0.1"
                />
              )}
              {/* Nom (sous la projection adulte si elle dépasse la couronne) */}
              {calques.etiquettes && (
                <text
                  x={0}
                  y={Math.max(r, rAdulte ?? 0) + 0.25}
                  textAnchor="middle"
                  fontSize={Math.min(r * 0.5, 0.25)}
                  fill="#1f2937"
                  fontWeight="600"
                  stroke="#ffffff"
                  strokeWidth={0.04}
                  strokeLinejoin="round"
                  paintOrder="stroke"
                  style={{ pointerEvents: "none" }}
                >
                  {arbre.nom}
                </text>
              )}
            </g>
          )
        })}

        {/* Planches */}
        {planches.map((planche) => {
          const x = planche.posX ?? 0
          const y = planche.posY ?? 0
          const w = planche.largeur ?? 0.8
          const l = planche.longueur ?? 2
          const isSelected = selectedPlanches.has(planche.id)
          const isDraggingThis = dragging?.type === 'planche' && dragging.id === planche.id

          return (
            <g
              key={planche.id}
              transform={`translate(${x}, ${y}) rotate(${planche.rotation2D ?? 0}, ${w/2}, ${l/2})`}
              onPointerDown={(e) => handleItemPointerDown(e, 'planche', planche.id)}
              filter="url(#garden-soft-shadow)"
              style={{ cursor: editable ? (isDraggingThis ? "grabbing" : "grab") : "pointer" }}
            >
              {/* Ombre */}
              <rect
                x={0.05}
                y={0.05}
                width={w}
                height={l}
                fill="rgba(0,0,0,0.15)"
                rx={0.05}
              />
              {/* Planche : terre nue texturée (les cultures apportent la couleur) */}
              <rect
                x={0}
                y={0}
                width={w}
                height={l}
                fill={plancheColor}
                stroke={isSelected ? "#3b82f6" : isDraggingThis ? "#60a5fa" : shade(plancheColor, -0.35)}
                strokeWidth={isSelected ? 0.1 : isDraggingThis ? 0.08 : 0.035}
                rx={0.05}
              />
              <rect
                x={0}
                y={0}
                width={w}
                height={l}
                fill="url(#tex-soil)"
                rx={0.05}
                style={{ pointerEvents: "none" }}
              />
              {/* Halo de selection */}
              {isSelected && (
                <rect
                  x={-0.05}
                  y={-0.05}
                  width={w + 0.1}
                  height={l + 0.1}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth={0.05}
                  strokeDasharray="0.2 0.1"
                  rx={0.08}
                />
              )}
              {/* Nom */}
              {calques.etiquettes && (
                <text
                  x={w / 2}
                  y={l / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={Math.min(w * 0.4, l * 0.15, 0.4)}
                  fill="#1f2937"
                  fontWeight="600"
                  stroke="#ffffff"
                  strokeWidth={0.045}
                  strokeLinejoin="round"
                  paintOrder="stroke"
                  style={{ pointerEvents: "none" }}
                >
                  {planche.nom || planche.id}
                </text>
              )}
              {/* Cultures en cours - sillons en pointillés */}
              {planche.cultures.length > 0 && (
                <>
                  {/* Bandes de couleurs en haut pour identification rapide */}
                  {planche.cultures.slice(0, 5).map((culture, idx) => {
                    const bandHeight = Math.min(0.1, l * 0.03)
                    const bandWidth = w / Math.min(planche.cultures.length, 5)
                    return (
                      <rect
                        key={`band-${culture.id}`}
                        x={idx * bandWidth}
                        y={0}
                        width={bandWidth}
                        height={bandHeight}
                        fill={culture.espece.couleur || culture.espece.famille?.couleur || "#22c55e"}
                        opacity={0.8}
                        style={{ pointerEvents: "none" }}
                      />
                    )
                  })}

                  {/* Cultures avec fond coloré + sillons centrés */}
                  {planche.cultures.slice(0, 3).map((culture, cultureIdx) => {
                    const nbRangs = culture.nbRangs || 3
                    const couleur = culture.espece.couleur || culture.espece.famille?.couleur || "#22c55e"
                    const largeurPlanche = planche.largeur || 0.8
                    const marge = 0.1 // Marge de chaque côté

                    // Si plusieurs cultures, diviser la planche en zones
                    const nbCultures = Math.min(planche.cultures.length, 3)
                    const zoneWidth = largeurPlanche / nbCultures
                    const zoneStartX = cultureIdx * zoneWidth
                    const zoneCenterX = zoneStartX + zoneWidth / 2

                    // Espacement entre rangs en mètres
                    const espacementRangsM = (culture.itp?.espacementRangs || 30) / 100

                    // Largeur totale occupée par les rangs (du centre du 1er au centre du dernier)
                    const largeurOccupee = (nbRangs - 1) * espacementRangsM

                    // Calculer l'espacement et la position de départ pour centrer
                    let spacing = espacementRangsM
                    const largeurDisponible = zoneWidth - 2 * marge

                    // Si ça dépasse la zone, ajuster l'espacement
                    if (largeurOccupee > largeurDisponible) {
                      spacing = nbRangs > 1 ? largeurDisponible / (nbRangs - 1) : 0
                    }

                    // Position du premier rang (centré)
                    const startX = zoneCenterX - (nbRangs - 1) * spacing / 2

                    // Empreinte des plantes à l'échelle : cercles au diamètre
                    // `espece.etalement` (m), espacés selon la culture/l'ITP —
                    // le pendant potager de l'envergure des arbres. Repli sur
                    // les sillons seuls si la donnée manque ou si le semis est
                    // trop dense pour rester lisible (ex. carottes en ligne).
                    const etalement = culture.espece.etalement || 0
                    const espacementPlantsM =
                      ((culture.espacement ?? culture.itp?.espacement ?? etalement * 100) || 0) / 100
                    const nbRangsDessines = Math.min(nbRangs, 10)
                    let plantsParRang = 0
                    let rayonPlant = 0
                    let premierPlantY = 0
                    if (etalement > 0 && espacementPlantsM >= 0.02) {
                      rayonPlant = Math.min(etalement / 2, zoneWidth / 2 - 0.01, l / 2 - 0.01)
                      const utile = l - 0.3 - 2 * rayonPlant
                      if (rayonPlant > 0.008 && utile >= 0) {
                        const n = Math.floor(utile / espacementPlantsM) + 1
                        if (n * nbRangsDessines <= 400) {
                          plantsParRang = n
                          premierPlantY =
                            0.15 + rayonPlant + (utile - (n - 1) * espacementPlantsM) / 2
                        }
                      }
                    }
                    // Zoom sémantique : sous 10 px/m une plante fait < 3 px,
                    // on retombe sur la zone teintée (plus lisible et léger).
                    const dessinePlants = plantsParRang > 0 && scale >= 10
                    // Silhouette selon la famille botanique ; fruits/gousses
                    // superposés quand la culture approche la maturité.
                    const silhouette = silhouettePour(culture.espece.famille?.id)
                    const fruitsVisibles =
                      SILHOUETTES_A_FRUITS.includes(silhouette) && (culture.croissance ?? 1) >= 0.75

                    return (
                      <g key={`culture-${culture.id}`}>
                        {/* Silhouette unitaire (rayon 1) de la famille botanique,
                            instanciée par plante via <use>. */}
                        <defs>{defsCulture(culture.id, silhouette, couleur, culture.id * 7)}</defs>
                        {/* Fond coloré de la zone culture (plus soutenu quand
                            les plantes ne sont pas dessinées) */}
                        <rect
                          x={zoneStartX}
                          y={0}
                          width={zoneWidth}
                          height={l}
                          fill={couleur}
                          opacity={dessinePlants ? 0.14 : 0.3}
                          style={{ pointerEvents: "none" }}
                        />

                        {/* Sillons centrés (discrets quand les plantes sont dessinées) */}
                        {Array.from({ length: nbRangsDessines }).map((_, rangIdx) => {
                          const x = startX + rangIdx * spacing
                          return (
                            <line
                              key={rangIdx}
                              x1={x}
                              y1={0.15}
                              x2={x}
                              y2={l - 0.15}
                              stroke="#1f2937"
                              strokeWidth={dessinePlants ? 0.03 : 0.08}
                              strokeDasharray="0.2,0.12"
                              opacity={dessinePlants ? 0.25 : 0.6}
                              style={{ pointerEvents: "none" }}
                            />
                          )
                        })}

                        {/* Plantes à l'échelle (étalement à maturité) : rosettes
                            de feuillage avec rotation/taille/position légèrement
                            variées par un bruit déterministe — l'alignement
                            reste net, l'aspect devient organique. */}
                        {dessinePlants &&
                          Array.from({ length: nbRangsDessines }).map((_, rangIdx) => {
                            const x = startX + rangIdx * spacing
                            return (
                              <g key={`plants-${rangIdx}`} style={{ pointerEvents: "none" }}>
                                {Array.from({ length: plantsParRang }).map((_, plantIdx) => {
                                  const seed = culture.id * 131 + rangIdx * 17 + plantIdx
                                  const rot = Math.round(rnd(seed) * 360)
                                  // Plan vivant : la taille dessinée suit la croissance réelle
                                  const sc = rayonPlant * (culture.croissance ?? 1) * (0.88 + 0.24 * rnd(seed + 3))
                                  const dx = (rnd(seed + 7) - 0.5) * rayonPlant * 0.25
                                  const dy = (rnd(seed + 11) - 0.5) * rayonPlant * 0.25
                                  const px = x + dx
                                  const py = premierPlantY + plantIdx * espacementPlantsM + dy
                                  return (
                                    <g
                                      key={plantIdx}
                                      transform={`translate(${px.toFixed(3)}, ${py.toFixed(3)}) rotate(${rot}) scale(${sc.toFixed(3)})`}
                                    >
                                      <use href={`#feuillage-${culture.id}`} />
                                      {fruitsVisibles && <use href={`#fruits-${culture.id}`} />}
                                    </g>
                                  )
                                })}
                              </g>
                            )
                          })}

                        {/* Label de la culture */}
                        {calques.etiquettes && (
                          <text
                            x={zoneStartX + zoneWidth / 2}
                            y={l - 0.2}
                            textAnchor="middle"
                            fontSize={0.14}
                            fill="#1f2937"
                            fontWeight="700"
                            stroke="#ffffff"
                            strokeWidth={0.035}
                            strokeLinejoin="round"
                            paintOrder="stroke"
                            opacity={0.95}
                            style={{ pointerEvents: "none" }}
                          >
                            {culture.espece.nom ?? culture.espece.id}
                          </text>
                        )}
                      </g>
                    )
                  })}

                  {/* Texte : nom de la première culture ou compteur */}
                  {calques.etiquettes && planche.cultures.length > 3 && (
                    <text
                      x={w / 2}
                      y={l - 0.15}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={0.12}
                      fill="#4b5563"
                      fontWeight="500"
                      style={{ pointerEvents: "none" }}
                    >
                      +{planche.cultures.length - 3} autres
                    </text>
                  )}
                </>
              )}

              {/* Couvert translucide des planches sous abri (Serre/Tunnel/Châssis) */}
              {(planche.type === 'Serre' || planche.type === 'Tunnel' || planche.type === 'Châssis') && (
                <g style={{ pointerEvents: "none" }}>
                  <rect
                    x={-0.06}
                    y={-0.06}
                    width={w + 0.12}
                    height={l + 0.12}
                    fill="#bfdbfe"
                    fillOpacity={0.25}
                    stroke="#60a5fa"
                    strokeWidth={0.035}
                    rx={0.1}
                  />
                  {planche.type !== 'Châssis' &&
                    Array.from({ length: Math.max(1, Math.floor(l / 0.7)) }).map((_, i) => (
                      <line
                        key={i}
                        x1={-0.06}
                        y1={(i + 0.5) * 0.7}
                        x2={w + 0.06}
                        y2={(i + 0.5) * 0.7}
                        stroke="#93c5fd"
                        strokeWidth={0.025}
                        opacity={0.8}
                      />
                    ))}
                  <circle cx={0.12} cy={0.12} r={0.05} fill="#ffffff" opacity={0.5} />
                </g>
              )}
            </g>
          )
        })}

        {/* Calque associations : liaisons favorables/défavorables entre planches */}
        {calques.associations && liaisons && liaisons.length > 0 && (
          <g style={{ pointerEvents: "none" }}>
            {liaisons.map((li, i) => {
              const couleurLiaison = li.type === 'favorable' ? '#16a34a' : '#dc2626'
              const mx = (li.x1 + li.x2) / 2
              const my = (li.y1 + li.y2) / 2
              return (
                <g key={i}>
                  <line
                    x1={li.x1}
                    y1={li.y1}
                    x2={li.x2}
                    y2={li.y2}
                    stroke={couleurLiaison}
                    strokeWidth={0.07}
                    strokeDasharray={li.type === 'favorable' ? undefined : "0.2 0.14"}
                    strokeLinecap="round"
                    opacity={0.65}
                  />
                  <circle cx={mx} cy={my} r={0.16} fill="white" stroke={couleurLiaison} strokeWidth={0.03} />
                  <text
                    x={mx}
                    y={my + 0.07}
                    textAnchor="middle"
                    fontSize={0.2}
                    fontWeight={700}
                    fill={couleurLiaison}
                  >
                    {li.type === 'favorable' ? '✓' : '✕'}
                  </text>
                </g>
              )
            })}
          </g>
        )}

        {/* Rectangle de selection (marquee) */}
        {marquee && hasMoved && (
          <rect
            x={Math.min(marquee.startX, marquee.currentX)}
            y={Math.min(marquee.startY, marquee.currentY)}
            width={Math.abs(marquee.currentX - marquee.startX)}
            height={Math.abs(marquee.currentY - marquee.startY)}
            fill="rgba(59, 130, 246, 0.1)"
            stroke="#3b82f6"
            strokeWidth={0.04}
            strokeDasharray="0.15 0.08"
            style={{ pointerEvents: "none" }}
          />
        )}

        {/* Outil mesure / calibration : ligne + distance, tailles constantes à l'écran */}
        {toolActive && (() => {
          const p1 = toolPoints[0] ?? null
          const p2 = toolPoints[1] ?? (toolPoints.length === 1 ? toolHover : null)
          const couleurOutil = tool === 'calibrate' ? '#2563eb' : '#b45309'
          const px = (n: number) => n / scale
          const dist = p1 && p2 ? Math.hypot(p2.x - p1.x, p2.y - p1.y) : null
          const label = dist !== null ? formatDistance(dist) : null
          const mid = p1 && p2 ? { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 } : null
          return (
            <g style={{ pointerEvents: "none" }}>
              {p1 && p2 && (
                <line
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={couleurOutil}
                  strokeWidth={px(2)}
                  strokeDasharray={toolPoints.length < 2 ? `${px(6)} ${px(4)}` : undefined}
                />
              )}
              {toolPoints.map((p, i) => (
                <g key={i}>
                  <circle cx={p.x} cy={p.y} r={px(5)} fill="white" stroke={couleurOutil} strokeWidth={px(2)} />
                  <circle cx={p.x} cy={p.y} r={px(1.5)} fill={couleurOutil} />
                </g>
              ))}
              {mid && label && (
                <g transform={`translate(${mid.x}, ${mid.y})`}>
                  <rect
                    x={-px(label.length * 4 + 8)}
                    y={-px(24)}
                    width={px(label.length * 8 + 16)}
                    height={px(18)}
                    rx={px(4)}
                    fill="white"
                    fillOpacity={0.92}
                    stroke={couleurOutil}
                    strokeWidth={px(1)}
                  />
                  <text
                    x={0}
                    y={-px(10)}
                    textAnchor="middle"
                    fontSize={px(12)}
                    fontWeight={600}
                    fill={couleurOutil}
                  >
                    {label}
                  </text>
                </g>
              )}
            </g>
          )
        })()}

        {/* Échelle */}
        <g transform={`translate(${effectiveViewBox.x + 0.3}, ${effectiveViewBox.y + effectiveViewBox.h - 0.3})`}>
          <rect x={-0.1} y={-0.25} width={1.4} height={0.4} fill="white" fillOpacity={0.8} rx={0.05} />
          <line x1={0} y1={0} x2={1} y2={0} stroke="#374151" strokeWidth={0.04} />
          <line x1={0} y1={-0.08} x2={0} y2={0.08} stroke="#374151" strokeWidth={0.04} />
          <line x1={1} y1={-0.08} x2={1} y2={0.08} stroke="#374151" strokeWidth={0.04} />
          <text x={0.5} y={-0.12} textAnchor="middle" fontSize={0.15} fill="#374151" fontWeight="500">1m</text>
        </g>
      </svg>
      </div>
    </div>
  )
}
