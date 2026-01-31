"use client"

import * as React from "react"

interface PlancheWithCulture {
  id: string
  largeur: number | null
  longueur: number | null
  posX: number | null
  posY: number | null
  rotation2D: number | null
  ilot: string | null
  cultures: {
    id: number
    nbRangs: number | null
    espacement: number | null
    itp: {
      espacementRangs: number | null
    } | null
    espece: {
      id: string
      couleur: string | null
      famille: { couleur: string | null } | null
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
  couleur: string | null
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
}

interface GardenViewProps {
  planches: PlancheWithCulture[]
  objets?: ObjetJardin[]
  arbres?: Arbre[]
  editable?: boolean
  selectedId?: string | null
  selectedObjetId?: number | null
  selectedArbreId?: number | null
  onPlancheMove?: (id: string, x: number, y: number) => void
  onPlancheClick?: (id: string) => void
  onObjetMove?: (id: number, x: number, y: number) => void
  onObjetClick?: (id: number) => void
  onArbreMove?: (id: number, x: number, y: number) => void
  onArbreClick?: (id: number) => void
  scale?: number // pixels per meter
  // Couleurs personnalisables
  plancheColor?: string
  selectedColor?: string
  gridColor?: string
  // Image de fond
  backgroundImage?: BackgroundImageSettings
}

export function GardenView({
  planches,
  objets = [],
  arbres = [],
  editable = false,
  selectedId,
  selectedObjetId,
  selectedArbreId,
  onPlancheMove,
  onPlancheClick,
  onObjetMove,
  onObjetClick,
  onArbreMove,
  onArbreClick,
  scale = 50,
  plancheColor = "#8B5A2B",
  selectedColor = "#22c55e",
  gridColor = "#e5e7eb",
  backgroundImage,
}: GardenViewProps) {
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [dragging, setDragging] = React.useState<{ type: 'planche' | 'objet' | 'arbre'; id: string | number } | null>(null)
  const [offset, setOffset] = React.useState({ x: 0, y: 0 })
  const [viewBox, setViewBox] = React.useState({ x: -1, y: -1, w: 20, h: 15 })
  const [bgImageSize, setBgImageSize] = React.useState<{ width: number; height: number } | null>(null)

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
      const r = a.envergure / 2
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
  }, [planches, objets, arbres, backgroundImage, bgImageSize])

  const getPlancheColor = (planche: PlancheWithCulture): string => {
    // Culture active
    const activeCulture = planche.cultures.find(c => c.espece)
    if (activeCulture) {
      return activeCulture.espece.couleur ||
             activeCulture.espece.famille?.couleur ||
             selectedColor
    }
    // Pas de culture - couleur par défaut
    return plancheColor
  }

  const handlePlancheMouseDown = (e: React.MouseEvent, plancheId: string) => {
    if (!editable) {
      onPlancheClick?.(plancheId)
      return
    }

    e.stopPropagation()

    const svg = svgRef.current
    if (!svg) return

    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const ctm = svg.getScreenCTM()
    if (!ctm) return
    const svgP = pt.matrixTransform(ctm.inverse())

    const planche = planches.find(p => p.id === plancheId)
    if (!planche) return

    setDragging({ type: 'planche', id: plancheId })
    setOffset({
      x: svgP.x - (planche.posX ?? 0),
      y: svgP.y - (planche.posY ?? 0)
    })
  }

  const handleObjetMouseDown = (e: React.MouseEvent, objetId: number) => {
    if (!editable) {
      onObjetClick?.(objetId)
      return
    }

    e.stopPropagation()

    const svg = svgRef.current
    if (!svg) return

    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const ctm = svg.getScreenCTM()
    if (!ctm) return
    const svgP = pt.matrixTransform(ctm.inverse())

    const objet = objets.find(o => o.id === objetId)
    if (!objet) return

    setDragging({ type: 'objet', id: objetId })
    setOffset({
      x: svgP.x - objet.posX,
      y: svgP.y - objet.posY
    })
  }

  const handleArbreMouseDown = (e: React.MouseEvent, arbreId: number) => {
    if (!editable) {
      onArbreClick?.(arbreId)
      return
    }

    e.stopPropagation()

    const svg = svgRef.current
    if (!svg) return

    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const ctm = svg.getScreenCTM()
    if (!ctm) return
    const svgP = pt.matrixTransform(ctm.inverse())

    const arbre = arbres.find(a => a.id === arbreId)
    if (!arbre) return

    setDragging({ type: 'arbre', id: arbreId })
    setOffset({
      x: svgP.x - arbre.posX,
      y: svgP.y - arbre.posY
    })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !editable) return

    const svg = svgRef.current
    if (!svg) return

    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const ctm = svg.getScreenCTM()
    if (!ctm) return
    const svgP = pt.matrixTransform(ctm.inverse())

    // Snap to 0.1m grid (plus fin pour un deplacement fluide)
    const snapGrid = 10 // 10 = 0.1m, 4 = 0.25m, 2 = 0.5m
    const newX = Math.round((svgP.x - offset.x) * snapGrid) / snapGrid
    const newY = Math.round((svgP.y - offset.y) * snapGrid) / snapGrid

    if (dragging.type === 'planche') {
      onPlancheMove?.(dragging.id as string, newX, newY)
    } else if (dragging.type === 'objet') {
      onObjetMove?.(dragging.id as number, newX, newY)
    } else if (dragging.type === 'arbre') {
      onArbreMove?.(dragging.id as number, newX, newY)
    }
  }

  const handleMouseUp = () => {
    if (dragging && editable) {
      if (dragging.type === 'planche') {
        onPlancheClick?.(dragging.id as string)
      } else if (dragging.type === 'objet') {
        onObjetClick?.(dragging.id as number)
      } else if (dragging.type === 'arbre') {
        onArbreClick?.(dragging.id as number)
      }
    }
    setDragging(null)
  }

  const handleSvgClick = (e: React.MouseEvent) => {
    // Clic sur le fond = désélectionner
    if (e.target === svgRef.current) {
      onPlancheClick?.("")
      onObjetClick?.(0)
      onArbreClick?.(0)
    }
  }

  const width = viewBox.w * scale
  const height = viewBox.h * scale

  // Générer les lignes de grille
  const gridLines = React.useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number; type: 'small' | 'medium' | 'large' }[] = []

    // Arrondir aux mètres pour aligner la grille
    const startX = Math.floor(viewBox.x)
    const endX = Math.ceil(viewBox.x + viewBox.w)
    const startY = Math.floor(viewBox.y)
    const endY = Math.ceil(viewBox.y + viewBox.h)

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
  }, [viewBox])

  return (
    <div className="overflow-auto" style={{ maxHeight: "600px" }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        className={editable ? "cursor-crosshair" : ""}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleSvgClick}
      >
        {/* Fond */}
        <rect
          x={viewBox.x}
          y={viewBox.y}
          width={viewBox.w}
          height={viewBox.h}
          fill="#f0fdf4"
        />

        {/* Image de fond (satellite) */}
        {backgroundImage?.image && bgImageSize && (
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
          </g>
        )}

        {/* Grille de fond - lignes réelles */}
        <g className="grid-lines">
          {gridLines.map((line, i) => (
            <line
              key={i}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={
                line.type === 'large' ? '#a3e635' :
                line.type === 'medium' ? '#d9f99d' : '#ecfccb'
              }
              strokeWidth={
                line.type === 'large' ? 0.04 :
                line.type === 'medium' ? 0.02 : 0.01
              }
            />
          ))}
        </g>

        {/* Objets de jardin (rendus en premier, sous les planches) */}
        {objets.map((objet) => {
          const color = objet.couleur || OBJET_COLORS[objet.type] || OBJET_COLORS.autre
          const isSelected = selectedObjetId === objet.id
          const isDraggingThis = dragging?.type === 'objet' && dragging.id === objet.id

          return (
            <g
              key={`objet-${objet.id}`}
              transform={`translate(${objet.posX}, ${objet.posY}) rotate(${objet.rotation2D}, ${objet.largeur/2}, ${objet.longueur/2})`}
              onMouseDown={(e) => handleObjetMouseDown(e, objet.id)}
              style={{ cursor: editable ? (isDraggingThis ? "grabbing" : "grab") : "pointer" }}
            >
              {/* Forme selon le type */}
              {objet.type === 'allee' || objet.type === 'passage' ? (
                // Allée/passage: texture simple
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
              ) : objet.type === 'bordure' ? (
                // Bordure: trait épais
                <rect
                  x={0}
                  y={0}
                  width={objet.largeur}
                  height={objet.longueur}
                  fill={color}
                  stroke={isSelected ? "#3b82f6" : "#57534e"}
                  strokeWidth={isSelected ? 0.08 : 0.04}
                />
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
                // Point d'eau: cercle bleu
                <ellipse
                  cx={objet.largeur / 2}
                  cy={objet.longueur / 2}
                  rx={objet.largeur / 2}
                  ry={objet.longueur / 2}
                  fill={color}
                  fillOpacity={0.6}
                  stroke={isSelected ? "#3b82f6" : "#3b82f6"}
                  strokeWidth={isSelected ? 0.08 : 0.03}
                />
              ) : (
                // Autres objets: rectangle simple
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
              )}
              {/* Halo de sélection */}
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
              {objet.nom && (
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
          const isSelected = selectedArbreId === arbre.id
          const isDraggingThis = dragging?.type === 'arbre' && dragging.id === arbre.id
          const r = arbre.envergure / 2

          return (
            <g
              key={`arbre-${arbre.id}`}
              transform={`translate(${arbre.posX}, ${arbre.posY})`}
              onMouseDown={(e) => handleArbreMouseDown(e, arbre.id)}
              style={{ cursor: editable ? (isDraggingThis ? "grabbing" : "grab") : "pointer" }}
            >
              {/* Ombre */}
              <circle
                cx={0.05}
                cy={0.05}
                r={r}
                fill="rgba(0,0,0,0.15)"
              />
              {/* Couronne de l'arbre */}
              <circle
                cx={0}
                cy={0}
                r={r}
                fill={color}
                fillOpacity={0.7}
                stroke={isSelected ? "#3b82f6" : isDraggingThis ? "#60a5fa" : "#166534"}
                strokeWidth={isSelected ? 0.1 : isDraggingThis ? 0.08 : 0.04}
              />
              {/* Point central (tronc) */}
              <circle
                cx={0}
                cy={0}
                r={0.1}
                fill="#78350f"
                style={{ pointerEvents: "none" }}
              />
              {/* Halo de sélection */}
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
              {/* Nom */}
              <text
                x={0}
                y={r + 0.25}
                textAnchor="middle"
                fontSize={Math.min(r * 0.5, 0.25)}
                fill="#1f2937"
                fontWeight="600"
                style={{ pointerEvents: "none" }}
              >
                {arbre.nom}
              </text>
            </g>
          )
        })}

        {/* Planches */}
        {planches.map((planche) => {
          const x = planche.posX ?? 0
          const y = planche.posY ?? 0
          const w = planche.largeur ?? 0.8
          const l = planche.longueur ?? 2
          const color = getPlancheColor(planche)
          const isSelected = selectedId === planche.id
          const isDraggingThis = dragging?.type === 'planche' && dragging.id === planche.id

          return (
            <g
              key={planche.id}
              transform={`translate(${x}, ${y}) rotate(${planche.rotation2D ?? 0}, ${w/2}, ${l/2})`}
              onMouseDown={(e) => handlePlancheMouseDown(e, planche.id)}
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
              {/* Planche */}
              <rect
                x={0}
                y={0}
                width={w}
                height={l}
                fill={color}
                stroke={isSelected ? "#3b82f6" : isDraggingThis ? "#60a5fa" : "#78716c"}
                strokeWidth={isSelected ? 0.1 : isDraggingThis ? 0.08 : 0.03}
                rx={0.05}
              />
              {/* Halo de sélection */}
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
              <text
                x={w / 2}
                y={l / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={Math.min(w * 0.4, l * 0.15, 0.4)}
                fill="#1f2937"
                fontWeight="600"
                style={{ pointerEvents: "none" }}
              >
                {planche.id}
              </text>
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

                  {/* Sillons en pointillés - dans le sens de la longueur avec espacement réel */}
                  {planche.cultures.slice(0, 3).map((culture, cultureIdx) => {
                    const nbRangs = culture.nbRangs || 3
                    const couleur = culture.espece.couleur || culture.espece.famille?.couleur || "#22c55e"
                    // Espacement entre rangs en mètres (espacementRangs est en cm dans l'ITP)
                    const espacementRangsM = (culture.itp?.espacementRangs || 30) / 100

                    // Calculer la largeur totale occupée par les rangs
                    const largeurOccupee = (nbRangs - 1) * espacementRangsM
                    const largeurPlanche = planche.largeur || 0.8

                    // Si la culture occupe plus que la largeur, proportionner
                    let spacing = espacementRangsM
                    let startX = (largeurPlanche - largeurOccupee) / 2 // Centrer

                    if (largeurOccupee > largeurPlanche - 0.1) {
                      // Réduire l'espacement pour tenir dans la planche
                      spacing = (largeurPlanche - 0.1) / (nbRangs - 1)
                      startX = 0.05
                    }

                    // Si plusieurs cultures, décaler selon la zone
                    if (planche.cultures.length > 1) {
                      const cultureWidth = largeurPlanche / Math.min(planche.cultures.length, 3)
                      startX = cultureIdx * cultureWidth + 0.05
                      spacing = Math.min(spacing, (cultureWidth - 0.1) / (nbRangs - 1 || 1))
                    }

                    return (
                      <g key={`sillons-${culture.id}`}>
                        {Array.from({ length: Math.min(nbRangs, 8) }).map((_, rangIdx) => {
                          const x = startX + rangIdx * spacing
                          return (
                            <line
                              key={rangIdx}
                              x1={x}
                              y1={0.1}
                              x2={x}
                              y2={l - 0.1}
                              stroke={couleur}
                              strokeWidth={0.04}
                              strokeDasharray="0.08,0.08"
                              opacity={0.9}
                              style={{ pointerEvents: "none" }}
                            />
                          )
                        })}
                      </g>
                    )
                  })}

                  {/* Texte : nom de la première culture ou compteur */}
                  {planche.cultures.length > 3 && (
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
            </g>
          )
        })}

        {/* Échelle */}
        <g transform={`translate(${viewBox.x + 0.3}, ${viewBox.y + viewBox.h - 0.3})`}>
          <rect x={-0.1} y={-0.25} width={1.4} height={0.4} fill="white" fillOpacity={0.8} rx={0.05} />
          <line x1={0} y1={0} x2={1} y2={0} stroke="#374151" strokeWidth={0.04} />
          <line x1={0} y1={-0.08} x2={0} y2={0.08} stroke="#374151" strokeWidth={0.04} />
          <line x1={1} y1={-0.08} x2={1} y2={0.08} stroke="#374151" strokeWidth={0.04} />
          <text x={0.5} y={-0.12} textAnchor="middle" fontSize={0.15} fill="#374151" fontWeight="500">1m</text>
        </g>
      </svg>
    </div>
  )
}
