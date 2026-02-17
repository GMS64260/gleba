"use client"

/**
 * Ligne Gantt pour un ITP
 * Affiche les barres colorées par phase sur 12 mois
 * Cliquable pour édition si onEdit est fourni
 */

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Pencil } from "lucide-react"

interface ITPWithEspece {
  id: string
  especeId: string | null
  espece?: {
    id: string
    couleur: string | null
  } | null
  semaineSemis: number | null
  semainePlantation: number | null
  semaineRecolte: number | null
  dureeRecolte: number | null
  typePlanche: string | null
  notes: string | null
}

interface GanttRowProps {
  itp: ITPWithEspece
  onEdit?: (itp: ITPWithEspece) => void
}

export function GanttRow({ itp, onEdit }: GanttRowProps) {
  // Calculer le type de culture
  const getTypeCulture = () => {
    if (itp.semaineSemis && itp.semainePlantation && itp.semaineRecolte) {
      return 'Pépinière'
    }
    if (itp.semaineSemis && !itp.semainePlantation && itp.semaineRecolte) {
      return 'Semis direct'
    }
    if (!itp.semaineSemis && itp.semainePlantation && itp.semaineRecolte) {
      return 'Plant'
    }
    return '?'
  }

  // Calculer les barres (position en % sur 52 semaines)
  const calculateBars = () => {
    const bars: { start: number; width: number; color: string; label: string }[] = []

    // Barre semis (orange) : semaineSemis → semainePlantation
    if (itp.semaineSemis && itp.semainePlantation) {
      bars.push({
        start: (itp.semaineSemis / 52) * 100,
        width: ((itp.semainePlantation - itp.semaineSemis) / 52) * 100,
        color: '#ff9800',
        label: 'Semis'
      })
    } else if (itp.semaineSemis && itp.semaineRecolte && !itp.semainePlantation) {
      // Semis direct : semaineSemis → semaineRecolte (orange)
      bars.push({
        start: (itp.semaineSemis / 52) * 100,
        width: ((itp.semaineRecolte - itp.semaineSemis) / 52) * 100,
        color: '#ff9800',
        label: 'Semis'
      })
    }

    // Barre croissance (vert) : semainePlantation → semaineRecolte
    if (itp.semainePlantation && itp.semaineRecolte) {
      bars.push({
        start: (itp.semainePlantation / 52) * 100,
        width: ((itp.semaineRecolte - itp.semainePlantation) / 52) * 100,
        color: '#4caf50',
        label: 'Croissance'
      })
    }

    // Barre récolte (violet) : semaineRecolte → semaineRecolte + dureeRecolte
    if (itp.semaineRecolte && itp.dureeRecolte) {
      bars.push({
        start: (itp.semaineRecolte / 52) * 100,
        width: ((itp.dureeRecolte) / 52) * 100,
        color: '#9c27b0',
        label: 'Récolte'
      })
    }

    return bars
  }

  const bars = calculateBars()
  const typeCulture = getTypeCulture()
  const isEditable = !!onEdit

  return (
    <tr
      className={`border-b transition-colors ${
        isEditable
          ? "hover:bg-muted/70 cursor-pointer group"
          : "hover:bg-muted/50"
      }`}
      onClick={isEditable ? () => onEdit(itp) : undefined}
    >
      {/* Colonne ITP/Espèce (sticky) */}
      <td className="p-2 sticky left-0 bg-white z-10 border-r">
        <div className="flex items-center gap-2">
          {itp.espece?.couleur && (
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: itp.espece.couleur }}
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="font-medium text-sm truncate">{itp.id}</div>
            {itp.especeId && (
              <div className="text-xs text-muted-foreground truncate">{itp.especeId}</div>
            )}
          </div>
          {isEditable && (
            <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          )}
        </div>
      </td>

      {/* Colonne Type */}
      <td className="p-2 border-r">
        <div className="space-y-1">
          <Badge variant="outline" className="text-xs whitespace-nowrap">
            {typeCulture}
          </Badge>
          {itp.typePlanche && (
            <div className="text-xs text-muted-foreground truncate">
              {itp.typePlanche}
            </div>
          )}
        </div>
      </td>

      {/* Timeline (12 mois) */}
      <td colSpan={12} className="p-0 relative h-12">
        <div className="absolute inset-0 flex">
          {/* Grilles verticales des mois */}
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 border-r border-gray-200"
              style={{ minWidth: '60px' }}
            />
          ))}
        </div>

        {/* Barres colorées */}
        <div className="absolute inset-0 px-1 py-2 pointer-events-none">
          {bars.map((bar, index) => (
            <div
              key={index}
              className="absolute rounded-sm opacity-80"
              style={{
                left: `${bar.start}%`,
                width: `${bar.width}%`,
                top: '8px',
                height: '28px',
                backgroundColor: bar.color,
              }}
              title={bar.label}
            />
          ))}
        </div>
      </td>
    </tr>
  )
}
