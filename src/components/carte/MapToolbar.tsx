"use client"

import { PenTool, FileDown, X, Pencil, Move, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface MapToolbarProps {
  onDrawStart: () => void
  onCadastreOpen: () => void
  isDrawing: boolean
  onDrawCancel: () => void
  /** Une parcelle est sélectionnée */
  hasSelection?: boolean
  /** Mode édition actif */
  isEditing?: boolean
  editMode?: "vertices" | "move"
  onEditVertices?: () => void
  onEditMove?: () => void
  onEditConfirm?: () => void
  onEditCancel?: () => void
}

export default function MapToolbar({
  onDrawStart,
  onCadastreOpen,
  isDrawing,
  onDrawCancel,
  hasSelection = false,
  isEditing = false,
  editMode,
  onEditVertices,
  onEditMove,
  onEditConfirm,
  onEditCancel,
}: MapToolbarProps) {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white shadow-md rounded-lg flex items-center gap-2 p-2">
      {isEditing ? (
        <>
          <span className="text-sm text-blue-600 font-medium px-2">
            {editMode === "vertices"
              ? "Glissez les sommets pour modifier le trace"
              : "Glissez la parcelle pour la deplacer"}
          </span>
          <Button
            size="sm"
            onClick={onEditConfirm}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
          >
            <Check className="h-4 w-4" />
            Valider
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onEditCancel}
            className="flex items-center gap-2"
          >
            <X className="h-4 w-4" />
            Annuler
          </Button>
        </>
      ) : isDrawing ? (
        <>
          <span className="text-sm text-muted-foreground px-2">
            Cliquez sur la carte pour placer les points du polygone
          </span>
          <Button
            variant="destructive"
            size="sm"
            onClick={onDrawCancel}
            className="flex items-center gap-2"
          >
            <X className="h-4 w-4" />
            Annuler
          </Button>
        </>
      ) : (
        <>
          {hasSelection && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onEditVertices}
                className="flex items-center gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
              >
                <Pencil className="h-4 w-4" />
                Modifier le trace
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onEditMove}
                className="flex items-center gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
              >
                <Move className="h-4 w-4" />
                Deplacer
              </Button>
              <div className="w-px h-6 bg-slate-200" />
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onDrawStart}
            className="flex items-center gap-2"
          >
            <PenTool className="h-4 w-4" />
            Dessiner une parcelle
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onCadastreOpen}
            className="flex items-center gap-2"
          >
            <FileDown className="h-4 w-4" />
            Importer du cadastre
          </Button>
        </>
      )}
    </div>
  )
}
