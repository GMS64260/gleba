"use client"

/**
 * Réglage de l'angle d'une planche ou d'un objet du plan 2D.
 *
 * Ticket cmu4mp12y (2026-09-16) et constat vigie0abcc (2026-09-18) : la
 * rotation n'existait que par pas de 15° (boutons −15/+15/90). Un pas de 15°
 * ne permet pas de caler une planche sur la limite réelle d'une parcelle ni
 * sur un tunnel existant — l'utilisateur demandait 5° à 7,5°, ou un angle
 * libre. Ici : saisie libre au demi-degré près, boutons ±5° et 90°.
 *
 * L'angle affiché est toujours normalisé dans [0, 360) : le schéma Zod des
 * routes refuse un angle négatif (audit 2026-07, #24), donc la normalisation
 * se fait ici, avant que la page ne mémorise la valeur.
 */

import * as React from "react"
import { RotateCcw, RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

/** Normalise un angle dans [0, 360), arrondi au dixième de degré. */
export function normaliserAngle(deg: number): number {
  const borne = ((deg % 360) + 360) % 360
  return Math.round(borne * 10) / 10
}

function formatAngle(deg: number): string {
  return String(normaliserAngle(deg))
}

interface RotationControlProps {
  /** Angle courant (degrés, sens horaire). */
  angle: number
  /** Reçoit le nouvel angle absolu, déjà normalisé. */
  onChange: (angle: number) => void
  /** Préfixe des identifiants DOM (un contrôle par panneau). */
  idPrefix: string
}

export function RotationControl({ angle, onChange, idPrefix }: RotationControlProps) {
  // Saisie locale : on laisse l'utilisateur taper « 12. » ou vider le champ
  // sans que la valeur mémorisée ne lui soit réimposée à chaque frappe.
  const [saisie, setSaisie] = React.useState(() => formatAngle(angle))
  React.useEffect(() => {
    setSaisie(formatAngle(angle))
  }, [angle])

  const appliquer = (valeur: number) => onChange(normaliserAngle(valeur))

  const handleSaisie = (event: React.ChangeEvent<HTMLInputElement>) => {
    const brut = event.target.value
    setSaisie(brut)
    const valeur = parseFloat(brut.replace(",", "."))
    if (Number.isFinite(valeur)) appliquer(valeur)
  }

  const inputId = `${idPrefix}-rotation`

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-1.5">
        <label htmlFor={inputId} className="text-sm text-muted-foreground">
          Rotation
        </label>
        <Input
          id={inputId}
          type="number"
          inputMode="decimal"
          step="0.5"
          min={0}
          max={359.5}
          className="h-7 w-20 px-2 text-sm"
          value={saisie}
          onChange={handleSaisie}
          onBlur={() => setSaisie(formatAngle(angle))}
          onKeyDown={(event) => {
            if (event.key === "Enter") (event.target as HTMLInputElement).blur()
          }}
          aria-label="Angle de rotation en degrés"
        />
        <span className="text-sm text-muted-foreground">°</span>
      </div>
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => appliquer(angle - 5)}
          title="Tourner de 5° vers la gauche"
          aria-label="Tourner de 5° vers la gauche"
        >
          <RotateCcw className="h-3 w-3" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => appliquer(angle + 5)}
          title="Tourner de 5° vers la droite"
          aria-label="Tourner de 5° vers la droite"
        >
          <RotateCw className="h-3 w-3" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => appliquer(angle + 90)}
          title="Tourner d'un quart de tour"
          aria-label="Tourner d'un quart de tour"
        >
          90°
        </Button>
      </div>
    </div>
  )
}
