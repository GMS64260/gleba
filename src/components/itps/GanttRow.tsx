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
    /** BUG #15 — mode_semis pour différencier pépinière vs caïeux/bulbe direct */
    modeSemis?: string | null
  } | null
  semaineSemis: number | null
  semainePlantation: number | null
  semaineRecolte: number | null
  dureeRecolte: number | null
  dureePepiniere?: number | null
  typePlanche: string | null
  notes: string | null
}

interface GanttRowProps {
  itp: ITPWithEspece
  onEdit?: (itp: ITPWithEspece) => void
}

export function GanttRow({ itp, onEdit }: GanttRowProps) {
  // BUG #15 (audit Marc 2026-05-15) : l'ail (mode bulbe_caieu) avait
  // s_semis (= préparation) + s_plantation (= mise en terre des caïeux)
  // tous deux renseignés, ce qui faisait afficher « Pépinière » alors
  // que l'ail se plante en caïeux direct au sol — pas de phase pépinière.
  // On désambiguïse via `espece.modeSemis` et `itp.dureePepiniere`.
  const getTypeCulture = () => {
    const mode = itp.espece?.modeSemis
    // Plantation directe pour les modes bulbe / bouture (ail, oignon caïeu,
    // pomme de terre, patate douce, kiwi, vigne…)
    if (mode === 'bulbe_caieu') return 'Plantation directe'
    if (mode === 'bouture') return 'Bouture'
    // Pépinière SEULEMENT si la durée pépinière est explicitement > 0
    // (on a une vraie phase de germination en pépinière). Sinon le couple
    // semis/plantation représente juste préparation → mise en terre.
    if (
      itp.semaineSemis &&
      itp.semainePlantation &&
      itp.semaineRecolte &&
      (itp.dureePepiniere ?? 0) > 0
    ) {
      return 'Pépinière'
    }
    if (itp.semaineSemis && !itp.semainePlantation && itp.semaineRecolte) {
      return 'Semis direct'
    }
    if (!itp.semaineSemis && itp.semainePlantation && itp.semaineRecolte) {
      return 'Plant'
    }
    // Fallback : si semis + plantation + récolte mais pas de pépinière
    // explicite, c'est une plantation directe (caïeux/bulbe le plus
    // probable, à confirmer côté Espèce).
    if (itp.semaineSemis && itp.semainePlantation && itp.semaineRecolte) {
      return 'Plantation directe'
    }
    return '?'
  }

  // Calculer les barres (position en % sur 52 semaines)
  //
  // Audit Marc 2026-05-14 — Bug 20 : la bande verte « Croissance »
  // n'apparaissait pas sur les ITPs en semis direct (ex: Petit pois,
  // Carotte, Radis) parce que la condition exigeait `semainePlantation`.
  // Pour ces cycles, on découpe désormais la phase semis→récolte en :
  //   * 3 semaines de "Semis" (orange) en début → germination + jeune plant
  //   * le reste en "Croissance" (vert) jusqu'à la récolte
  // Sources : J.-M. Fortier, Le Jardinier-Maraîcher (phase germination).
  const PHASE_SEMIS_SEMAINES_DIRECT = 3

  const calculateBars = () => {
    const bars: { start: number; width: number; color: string; label: string }[] = []

    // Cas pépinière : Semis (orange) puis Croissance (vert)
    if (itp.semaineSemis && itp.semainePlantation) {
      bars.push({
        start: (itp.semaineSemis / 52) * 100,
        width: ((itp.semainePlantation - itp.semaineSemis) / 52) * 100,
        color: '#ff9800',
        label: 'Semis'
      })
    } else if (itp.semaineSemis && itp.semaineRecolte && !itp.semainePlantation) {
      // Cas semis direct : on découpe en Semis (3 sem) + Croissance
      const cycle = itp.semaineRecolte - itp.semaineSemis
      const semisFin = itp.semaineSemis + Math.min(PHASE_SEMIS_SEMAINES_DIRECT, Math.max(1, Math.floor(cycle / 3)))
      bars.push({
        start: (itp.semaineSemis / 52) * 100,
        width: ((semisFin - itp.semaineSemis) / 52) * 100,
        color: '#ff9800',
        label: 'Semis / germination'
      })
      bars.push({
        start: (semisFin / 52) * 100,
        width: ((itp.semaineRecolte - semisFin) / 52) * 100,
        color: '#4caf50',
        label: 'Croissance'
      })
    }

    // Cas pépinière (suite) : bande croissance
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
              className="flex-1 border-r border-slate-200"
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
