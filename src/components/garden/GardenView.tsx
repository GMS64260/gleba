"use client"

import * as React from "react"
import { useToast } from "@/hooks/use-toast"

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

interface GardenViewProps {
  planches: PlancheWithCulture[]
  editable?: boolean
  onPlancheMove?: (id: string, x: number, y: number) => void
  scale?: number // pixels per meter
}

export function GardenView({
  planches,
  editable = false,
  onPlancheMove,
  scale = 40 // 40px = 1m par défaut
}: GardenViewProps) {
  const { toast } = useToast()
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [dragging, setDragging] = React.useState<string | null>(null)
  const [offset, setOffset] = React.useState({ x: 0, y: 0 })
  const [viewBox, setViewBox] = React.useState({ x: -1, y: -1, w: 20, h: 15 })

  // Calculer la taille du jardin basée sur les planches
  React.useEffect(() => {
    if (planches.length === 0) return

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

    // Ajouter une marge
    const margin = 2
    setViewBox({
      x: minX - margin,
      y: minY - margin,
      w: Math.max(maxX - minX + margin * 2, 10),
      h: Math.max(maxY - minY + margin * 2, 8)
    })
  }, [planches])

  const getPlancheColor = (planche: PlancheWithCulture): string => {
    // Culture active
    const activeCulture = planche.cultures.find(c => c.espece)
    if (activeCulture) {
      return activeCulture.espece.couleur ||
             activeCulture.espece.famille?.couleur ||
             "#22c55e"
    }
    // Pas de culture
    return "#d4d4d4"
  }

  const handleMouseDown = (e: React.MouseEvent, plancheId: string) => {
    if (!editable) return

    const svg = svgRef.current
    if (!svg) return

    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse())

    const planche = planches.find(p => p.id === plancheId)
    if (!planche) return

    setDragging(plancheId)
    setOffset({
      x: svgP.x - (planche.posX ?? 0),
      y: svgP.y - (planche.posY ?? 0)
    })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !editable) return

    const svg = svgRef.current
    if (!svg) return

    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse())

    // Snap to 0.5m grid
    const newX = Math.round((svgP.x - offset.x) * 2) / 2
    const newY = Math.round((svgP.y - offset.y) * 2) / 2

    onPlancheMove?.(dragging, newX, newY)
  }

  const handleMouseUp = () => {
    if (dragging) {
      setDragging(null)
    }
  }

  const width = viewBox.w * scale
  const height = viewBox.h * scale

  return (
    <div className="border rounded-lg bg-gradient-to-br from-green-50 to-amber-50 overflow-auto">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        className={editable ? "cursor-move" : ""}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Grille de fond */}
        <defs>
          <pattern id="grid" width="1" height="1" patternUnits="userSpaceOnUse">
            <path d="M 1 0 L 0 0 0 1" fill="none" stroke="#e5e7eb" strokeWidth="0.02" />
          </pattern>
          <pattern id="gridLarge" width="5" height="5" patternUnits="userSpaceOnUse">
            <path d="M 5 0 L 0 0 0 5" fill="none" stroke="#d1d5db" strokeWidth="0.04" />
          </pattern>
        </defs>
        <rect x={viewBox.x} y={viewBox.y} width={viewBox.w} height={viewBox.h} fill="url(#grid)" />
        <rect x={viewBox.x} y={viewBox.y} width={viewBox.w} height={viewBox.h} fill="url(#gridLarge)" />

        {/* Planches */}
        {planches.map((planche) => {
          const x = planche.posX ?? 0
          const y = planche.posY ?? 0
          const w = planche.largeur ?? 0.8
          const l = planche.longueur ?? 2
          const color = getPlancheColor(planche)
          const isActive = dragging === planche.id

          return (
            <g
              key={planche.id}
              transform={`translate(${x}, ${y}) rotate(${planche.rotation2D ?? 0}, ${w/2}, ${l/2})`}
              onMouseDown={(e) => handleMouseDown(e, planche.id)}
              style={{ cursor: editable ? "grab" : "pointer" }}
            >
              {/* Ombre */}
              <rect
                x={0.05}
                y={0.05}
                width={w}
                height={l}
                fill="rgba(0,0,0,0.1)"
                rx={0.05}
              />
              {/* Planche */}
              <rect
                x={0}
                y={0}
                width={w}
                height={l}
                fill={color}
                stroke={isActive ? "#3b82f6" : "#78716c"}
                strokeWidth={isActive ? 0.08 : 0.04}
                rx={0.05}
                className="transition-all"
              />
              {/* Nom */}
              <text
                x={w / 2}
                y={l / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={Math.min(w, l) * 0.25}
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
                  y={l / 2 + Math.min(w, l) * 0.25}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={Math.min(w, l) * 0.15}
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
        <g transform={`translate(${viewBox.x + 0.5}, ${viewBox.y + viewBox.h - 0.5})`}>
          <line x1={0} y1={0} x2={1} y2={0} stroke="#374151" strokeWidth={0.05} />
          <line x1={0} y1={-0.1} x2={0} y2={0.1} stroke="#374151" strokeWidth={0.05} />
          <line x1={1} y1={-0.1} x2={1} y2={0.1} stroke="#374151" strokeWidth={0.05} />
          <text x={0.5} y={-0.15} textAnchor="middle" fontSize={0.2} fill="#374151">1m</text>
        </g>
      </svg>

      {editable && (
        <div className="p-2 text-xs text-muted-foreground bg-white/80 border-t">
          Glissez les planches pour les positionner. Grille: 0.5m
        </div>
      )}
    </div>
  )
}
