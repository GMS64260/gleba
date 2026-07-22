"use client"

/**
 * Point d'entrée de la vue 3D : charge la scène react-three-fiber en dynamic
 * import `ssr: false`. three.js (~600 Ko) n'est ainsi jamais servi au SSR ni
 * inclus dans le bundle des autres pages — même isolation que l'éditeur 2D.
 */

import dynamic from "next/dynamic"
import * as React from "react"

import type { Garden3DData, Garden3DFond, Planche3D } from "./types"

const Garden3DScene = dynamic(() => import("./Garden3DScene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-sky-100 to-emerald-50">
      <div className="flex flex-col items-center gap-3 text-emerald-700">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-300 border-t-emerald-600" />
        <p className="text-sm font-medium">Chargement de la vue 3D…</p>
      </div>
    </div>
  ),
})

export interface Garden3DViewProps {
  data: Garden3DData
  fond?: Garden3DFond | null
  autoRotate?: boolean
  showLabels?: boolean
  selectedPlancheId?: string | null
  onSelectPlanche?: (planche: Planche3D) => void
}

export function Garden3DView({ data, fond, autoRotate, showLabels, selectedPlancheId, onSelectPlanche }: Garden3DViewProps) {
  return (
    <div className="h-full w-full">
      <Garden3DScene data={data} fond={fond} autoRotate={autoRotate} showLabels={showLabels} selectedPlancheId={selectedPlancheId} onSelectPlanche={onSelectPlanche} />
    </div>
  )
}

export type { Garden3DData, Garden3DFond, Planche3D, Culture3D } from "./types"
