"use client"

/**
 * Ligne Gantt pour un ITP
 * Affiche les barres colorées par phase sur 12 mois
 * Cliquable pour édition si onEdit est fourni
 */

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Pencil } from "lucide-react"
import { appliquerDecalageItp } from "@/lib/calendrier-climat"
import { nomAffichableItp } from "@/lib/itp-label"
import { barresGantt } from "./gantt-barres"
import type { ItpVue } from "./types"

interface GanttRowProps {
  itp: ItpVue
  onEdit?: (itp: ItpVue) => void
  /**
   * Décalage en semaines appliqué aux dates de semis/plantation/récolte pour
   * l'affichage (zone climatique + réglage fin précoce/tardif). L'ITP de
   * référence n'est PAS modifié : on recale uniquement les barres.
   */
  decalage?: number
}

/**
 * Mémoïsée : le calendrier rend jusqu'à cent lignes et se redessinait en
 * entier à chaque frappe dans la recherche ou réglage du décalage d'une autre
 * ligne. Les propriétés sont stables (ITP de la liste, `onEdit` en
 * `useCallback`, décalage numérique).
 */
export const GanttRow = React.memo(function GanttRow({
  itp: itpRef,
  onEdit,
  decalage = 0,
}: GanttRowProps) {
  // On travaille sur une copie décalée pour le rendu des barres et du type de
  // culture ; `onEdit` reçoit l'ITP de référence d'origine (édition en base).
  const itp = React.useMemo(
    () => appliquerDecalageItp(itpRef, decalage),
    [itpRef, decalage]
  )
  // BUG #15 (audit Marc 2026-05-15) : l'ail (mode bulbe_caieu) avait
  // s_semis (= préparation) + s_plantation (= mise en terre des caïeux)
  // tous deux renseignés, ce qui faisait afficher « Pépinière » alors
  // que l'ail se plante en caïeux direct au sol — pas de phase pépinière.
  // On désambiguïse via `espece.modeSemis` et `itp.dureePepiniere`.
  const getTypeCulture = () => {
    if (itp.implantation === 'Semis') return 'Semis direct'
    if (itp.implantation === 'Plantation') return 'Plantation'
    if (itp.implantation === 'Semis et implantation') return 'Semis et plantation'

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
    // Le repli annonçait « Plantation directe » dès que semis, plantation et
    // récolte étaient renseignés sans durée de pépinière — or 33 ITP seulement
    // sur 769 portent une durée de pépinière, si bien que 36 itinéraires
    // d'espèces qui se REPIQUENT (laitue, poireau, tomate, chou, melon, basilic)
    // étaient étiquetés « plantation directe », l'inverse de leur conduite.
    // L'espèce sait, elle : on lui demande avant de deviner.
    if (itp.semaineSemis && itp.semainePlantation && itp.semaineRecolte) {
      if (itp.espece?.typeCultureSemis === 'pepiniere_puis_repiquage') return 'Pépinière'
      if (itp.espece?.typeCultureSemis === 'semis_direct') return 'Semis direct'
      return 'Plantation directe'
    }
    return '?'
  }

  // Le tracé vit dans `gantt-barres.ts` (logique pure, testée) : barres qui
  // bouclent en fin d'année, croissance indicative, barre de récolte.
  const bars = React.useMemo(() => barresGantt(itp), [itp])
  const typeCulture = getTypeCulture()
  const isEditable = !!onEdit

  return (
    <tr
      className={`border-b transition-colors ${
        isEditable
          ? "hover:bg-muted/70 cursor-pointer group"
          : "hover:bg-muted/50"
      }`}
      onClick={isEditable ? () => onEdit(itpRef) : undefined}
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
            <div className="font-medium text-sm truncate">{nomAffichableItp(itp)}</div>
            {itp.especeId && (
              <div className="text-xs text-muted-foreground truncate">{itp.espece?.nom ?? itp.espece?.id ?? itp.especeId}</div>
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
          {itp.statutValidation === 'source_documentee' && (
            <div className="text-[10px] font-medium text-emerald-700">
              Source documentée
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
})
