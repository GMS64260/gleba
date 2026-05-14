"use client"

import { Crosshair, Map } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'

interface ParcelleGeoData {
  id: string
  nom: string
  geometry: string
  surface?: number | null
  commune?: string | null
  section?: string | null
  numero?: string | null
  usage?: string | null
  couleur?: string | null
  notes?: string | null
  typeSol?: string | null
}

interface ParcelleListProps {
  parcelles: ParcelleGeoData[]
  selectedId: string | null
  onSelect: (parcelle: ParcelleGeoData) => void
  onFlyTo: (parcelle: ParcelleGeoData) => void
}

// Labels lisibles pour les usages
const USAGE_LABELS: Record<string, string> = {
  culture: 'Culture',
  prairie: 'Prairie',
  verger: 'Verger',
  friche: 'Friche',
  jardin: 'Jardin',
  autre: 'Autre',
}

/**
 * Panneau lateral gauche listant toutes les parcelles.
 * Permet de selectionner une parcelle et de centrer la carte dessus.
 */
export default function ParcelleList({
  parcelles,
  selectedId,
  onSelect,
  onFlyTo,
}: ParcelleListProps) {
  // Formater la surface en hectares
  const formatSurface = (surface: number | null | undefined): string => {
    if (surface == null) return '--'
    return `${surface.toFixed(2)} ha`
  }

  return (
    <div className="w-64 bg-white shadow-lg h-full flex flex-col border-r">
      {/* En-tete */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <Map className="h-5 w-5 text-green-600" />
          <h2 className="text-lg font-semibold text-slate-900">Mes parcelles</h2>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {parcelles.length} parcelle{parcelles.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Liste scrollable */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {parcelles.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Aucune parcelle. Dessinez ou importez du cadastre.
            </div>
          ) : (
            parcelles.map((parcelle) => {
              const isSelected = parcelle.id === selectedId
              return (
                <Card
                  key={parcelle.id}
                  className={`cursor-pointer transition-colors p-3 ${
                    isSelected
                      ? 'border-green-500 border-2 bg-green-50'
                      : 'hover:bg-slate-50'
                  }`}
                  onClick={() => onSelect(parcelle)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {/* Nom avec indicateur de couleur */}
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: parcelle.couleur ?? '#16a34a' }}
                        />
                        <span className="font-medium text-sm truncate">
                          {parcelle.nom}
                        </span>
                      </div>

                      {/* Surface */}
                      <p className="text-xs text-muted-foreground mt-1 ml-5">
                        {formatSurface(parcelle.surface)}
                      </p>

                      {/* Usage */}
                      {parcelle.usage && (
                        <p className="text-xs text-muted-foreground ml-5">
                          {USAGE_LABELS[parcelle.usage] ?? parcelle.usage}
                        </p>
                      )}
                    </div>

                    {/* Bouton centrer */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        onFlyTo(parcelle)
                      }}
                      title="Centrer sur la parcelle"
                    >
                      <Crosshair className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              )
            })
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
