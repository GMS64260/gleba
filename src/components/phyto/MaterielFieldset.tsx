"use client"

/**
 * DEV3 #6 — Audit Marc 2026-05-14.
 *
 * Multi-select libre pour matériel utilisé sur une opération.
 * Pré-renseigne les matériels les plus courants (pulvérisateur, sécateur,
 * échelle, broyeur, tronçonneuse, etc.) en suggestion ; l'utilisateur peut
 * ajouter son propre libellé.
 */

import * as React from "react"
import { X, Wrench, Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

const SUGGESTIONS_MATERIEL = [
  "Pulvérisateur dorsal",
  "Pulvérisateur tracté",
  "Sécateur électrique",
  "Sécateur manuel",
  "Échelle simple",
  "Échelle à plateforme",
  "Broyeur",
  "Tronçonneuse",
  "Élagueuse perche",
  "Greffoir",
  "Brouette",
  "Bêche",
  "Houe",
  "Râteau",
  "Tarière",
  "Coupe-branches",
] as const

interface MaterielFieldsetProps {
  value: string[]
  onChange: (next: string[]) => void
  legend?: string
}

export function MaterielFieldset({ value, onChange, legend = "Matériel utilisé" }: MaterielFieldsetProps) {
  const [input, setInput] = React.useState("")

  const addMateriel = (label: string) => {
    const cleaned = label.trim()
    if (!cleaned) return
    if (value.includes(cleaned)) return
    onChange([...value, cleaned])
    setInput("")
  }

  const removeMateriel = (label: string) => {
    onChange(value.filter((m) => m !== label))
  }

  const suggestions = SUGGESTIONS_MATERIEL.filter(
    (s) => !value.includes(s) && (input === "" || s.toLowerCase().includes(input.toLowerCase()))
  )

  return (
    <fieldset className="rounded-md border bg-slate-50/60 p-3 space-y-2">
      <legend className="px-2 text-xs font-semibold text-slate-700 flex items-center gap-1">
        <Wrench className="h-3 w-3" />
        {legend}
      </legend>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((m) => (
            <Badge
              key={m}
              variant="secondary"
              className="text-xs gap-1 cursor-pointer hover:bg-slate-200"
              onClick={() => removeMateriel(m)}
            >
              {m}
              <X className="h-3 w-3" />
            </Badge>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          placeholder="Ajouter ou choisir…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              addMateriel(input)
            }
          }}
          className="text-xs h-8"
        />
        {input && !suggestions.includes(input as (typeof SUGGESTIONS_MATERIEL)[number]) && (
          <button
            type="button"
            onClick={() => addMateriel(input)}
            className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 text-xs hover:bg-emerald-100"
          >
            <Plus className="h-3 w-3" />
            Ajouter
          </button>
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {suggestions.slice(0, 8).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addMateriel(s)}
              className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] hover:bg-slate-100"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </fieldset>
  )
}
