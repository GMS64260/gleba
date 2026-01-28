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

interface GardenViewProps {
  planches: PlancheWithCulture[]
  objets?: ObjetJardin[]
  editable?: boolean
  selectedId?: string | null
  selectedObjetId?: number | null
  onPlancheMove?: (id: string, x: number, y: number) => void
  onPlancheClick?: (id: string) => void
  onObjetMove?: (id: number, x: number, y: number) => void
  onObjetClick?: (id: number) => void
  scale?: number // pixels per meter
}

export function GardenView({
  planches,
  objets = [],
  editable = false,
  selectedId,
  selectedObjetId,
  onPlancheMove,
  onPlancheClick,
  onObjetMove,
  onObjetClick,
  scale = 50
}: GardenViewProps) {
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [dragging, setDragging] = React.useState<{ type: 'planche' | 'objet'; id: string | number } | null>(null)
  const [offset, setOffset] = React.useState({ x: 0, y: 0 })
  const [viewBox, setViewBox] = React.useState({ x: -1, y: -1, w: 20, h: 15 })

  // Calculer la taille du jardin basée sur les planches ET les objets
  React.useEffect(() => {
    if (planches.length === 0 && objets.length === 0) return

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

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

    // Ajouter une marge
    const margin = 1
    setViewBox({
      x: Math.min(minX - margin, -1),
      y: Math.min(minY - margin, -1),
      w: Math.max(maxX - minX + margin * 2, 10),
      h: Math.max(maxY - minY + margin * 2, 8)
    })
  }, [planches, objets])

  const getPlancheColor = (planche: PlancheWithCulture): string => {
    // Culture active
    const activeCulture = planche.cultures.find(c => c.espece)
    if (activeCulture) {
      return activeCulture.espece.couleur ||
             activeCulture.espece.famille?.couleur ||
             "#22c55e"
    }
    // Pas de culture - gris clair
    return "#e5e7eb"
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

    // Snap to 0.5m grid
    const newX = Math.round((svgP.x - offset.x) * 2) / 2
    const newY = Math.round((svgP.y - offset.y) * 2) / 2

    if (dragging.type === 'planche') {
      onPlancheMove?.(dragging.id as string, newX, newY)
    } else {
      onObjetMove?.(dragging.id as number, newX, newY)
    }
  }

  const handleMouseUp = () => {
    if (dragging && editable) {
      if (dragging.type === 'planche') {
        onPlancheClick?.(dragging.id as string)
      } else {
        onObjetClick?.(dragging.id as number)
      }
    }
    setDragging(null)
  }

  const handleSvgClick = (e: React.MouseEvent) => {
    // Clic sur le fond = désélectionner
    if (e.target === svgRef.current) {
      onPlancheClick?.("")
      onObjetClick?.(0)
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
                // Allée/passage: texture gravier
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
                  {/* Motif gravier */}
                  {Array.from({ length: Math.floor(objet.largeur * objet.longueur * 3) }).map((_, i) => (
                    <circle
                      key={i}
                      cx={Math.random() * objet.largeur}
                      cy={Math.random() * objet.longueur}
                      r={0.03}
                      fill={i % 2 === 0 ? "#c4b8a8" : "#b8a898"}
                      style={{ pointerEvents: "none" }}
                    />
                  ))}
                </>
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
              {/* Culture en cours */}
              {planche.cultures[0] && (
                <text
                  x={w / 2}
                  y={l / 2 + Math.min(w * 0.25, l * 0.1, 0.3)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={Math.min(w * 0.25, l * 0.1, 0.25)}
                  fill="#4b5563"
                  style={{ pointerEvents: "none" }}
                >
                  {planche.cultures[0].espece.id}
                </text>
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
