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

export function GanttRow({ itp: itpRef, onEdit, decalage = 0 }: GanttRowProps) {
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

  // Bug testeur 2026-05-29 (Carotte-automne-conservation-serre) — durée en
  // semaines entre deux semaines de l'année, en tenant compte d'un passage
  // d'année (récolte < semis → +52). Sans ça, `recolte - semis` était négatif
  // et les barres avaient une largeur < 0 (semis/croissance invisibles).
  const dureeSem = (debut: number, fin: number) =>
    fin >= debut ? fin - debut : fin + 52 - debut
  // Largeur en %, bornée pour ne pas déborder de l'axe 52 semaines (les cycles
  // qui débordent sur l'année suivante sont tronqués proprement à S52).
  const barre = (debut: number, dureeSemaines: number, color: string, label: string) => {
    const start = ((debut - 1) / 52) * 100
    const width = Math.min(100 - start, Math.max(0, (dureeSemaines / 52) * 100))
    return { start, width, color, label }
  }

  const calculateBars = () => {
    const bars: { start: number; width: number; color: string; label: string }[] = []

    const pushWindow = (debut: number, fin: number, color: string, label: string) => {
      if (fin >= debut) {
        bars.push(barre(debut, fin - debut + 1, color, label))
        return
      }
      bars.push(barre(debut, 53 - debut, color, label))
      bars.push(barre(1, fin, color, label))
    }

    // Jeu documenté : les bornes sont de vraies fenêtres de décision, pas une
    // date unique artificielle. On les rend directement et on garde une bande
    // de croissance indicative entre la fin d'implantation et la récolte.
    if (itp.semaineImplantationDebut && itp.semaineImplantationFin) {
      pushWindow(
        itp.semaineImplantationDebut,
        itp.semaineImplantationFin,
        '#f59e0b',
        itp.implantation ?? 'Implantation'
      )
      if (itp.semaineRecolte) {
        const croissanceDebut = itp.semaineImplantationFin
        const croissance = dureeSem(croissanceDebut, itp.semaineRecolte)
        if (croissance > 0) {
          const croissanceFin = itp.semaineRecolte === 1 ? 52 : itp.semaineRecolte - 1
          pushWindow(
            croissanceDebut,
            croissanceFin,
            '#4caf50',
            'Croissance indicative'
          )
        }
      }
      if (itp.semaineRecolte && itp.semaineRecolteFin) {
        pushWindow(
          itp.semaineRecolte,
          itp.semaineRecolteFin,
          '#9c27b0',
          'Fenêtre de récolte'
        )
      }
      // Semis en pépinière ANTÉRIEUR à la fenêtre d'implantation : cette branche
      // rendait la fenêtre puis sortait, si bien que les 14 itinéraires dont le
      // semis précède l'implantation (zinnia S13 pour une implantation S18–S22,
      // muflier S8 pour S14–S18, giroflée S32 pour S40–S44…) n'affichaient aucune
      // barre de semis — alors que la planification, elle, part bien du semis
      // (`semaineSemisEffective`).
      if (
        itp.semaineSemis &&
        itp.semaineSemis !== itp.semaineImplantationDebut &&
        dureeSem(itp.semaineSemis, itp.semaineImplantationDebut) > 0 &&
        dureeSem(itp.semaineSemis, itp.semaineImplantationDebut) < 26
      ) {
        pushWindow(
          itp.semaineSemis,
          itp.semaineImplantationDebut === 1 ? 52 : itp.semaineImplantationDebut - 1,
          '#ff9800',
          'Semis en pépinière'
        )
      }
      return bars
    }

    // Cas pépinière : Semis (orange) puis Croissance (vert)
    if (itp.semaineSemis && itp.semainePlantation) {
      bars.push(barre(itp.semaineSemis, dureeSem(itp.semaineSemis, itp.semainePlantation), '#ff9800', 'Semis'))
    } else if (itp.semaineSemis && itp.semaineRecolte && !itp.semainePlantation) {
      // Cas semis direct : on découpe en Semis (3 sem) + Croissance
      const cycle = dureeSem(itp.semaineSemis, itp.semaineRecolte)
      const phaseSemis = Math.min(PHASE_SEMIS_SEMAINES_DIRECT, Math.max(1, Math.floor(cycle / 3)))
      bars.push(barre(itp.semaineSemis, phaseSemis, '#ff9800', 'Semis / germination'))
      bars.push(barre(itp.semaineSemis + phaseSemis, cycle - phaseSemis, '#4caf50', 'Croissance'))
    }

    // Cas pépinière (suite) : bande croissance
    if (itp.semainePlantation && itp.semaineRecolte) {
      bars.push(barre(itp.semainePlantation, dureeSem(itp.semainePlantation, itp.semaineRecolte), '#4caf50', 'Croissance'))
    }

    // Barre récolte (violet) : semaineRecolte → semaineRecolte + dureeRecolte
    if (itp.semaineRecolte && itp.dureeRecolte) {
      bars.push(barre(itp.semaineRecolte, itp.dureeRecolte, '#9c27b0', 'Récolte'))
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
}
