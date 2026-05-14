"use client"

/**
 * DEV3 audit Marc 2026-05-14 - Bloc EPI obligatoire.
 *
 * EPI = Équipements de Protection Individuelle (Arrêté 16/06/2009, art. 4).
 * Sélection multiple ; un avertissement est affiché si la méthode est
 * chimique et qu'aucun EPI n'est sélectionné.
 */

import * as React from "react"
import { ShieldAlert } from "lucide-react"
import { Label } from "@/components/ui/label"

export const EPI_OPTIONS = [
  { slug: "gants", label: "Gants nitrile" },
  { slug: "masque_a2p3", label: "Masque A2P3" },
  { slug: "combinaison", label: "Combinaison cat. III type 4" },
  { slug: "lunettes", label: "Lunettes étanches" },
  { slug: "bottes", label: "Bottes étanches" },
] as const

export type EpiSlug = (typeof EPI_OPTIONS)[number]["slug"]

interface EpiFieldsetProps {
  value: string[]
  onChange: (next: string[]) => void
  /** Si true et value vide, affiche un avertissement (méthode chimique). */
  warnIfEmpty?: boolean
  required?: boolean
}

export function EpiFieldset({ value, onChange, warnIfEmpty = false, required = false }: EpiFieldsetProps) {
  const toggle = (slug: string) => {
    onChange(value.includes(slug) ? value.filter((s) => s !== slug) : [...value, slug])
  }

  return (
    <fieldset className="rounded-md border bg-slate-50/60 p-3">
      <legend className="px-2 text-xs font-semibold text-slate-700 flex items-center gap-1">
        <ShieldAlert className="h-3 w-3" />
        EPI portés
        {required && <span className="text-red-600">*</span>}
      </legend>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {EPI_OPTIONS.map((o) => {
          const checked = value.includes(o.slug)
          return (
            <label
              key={o.slug}
              className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs cursor-pointer transition-colors ${
                checked ? "bg-emerald-50 border-emerald-300" : "bg-white hover:bg-slate-100"
              }`}
            >
              <input
                type="checkbox"
                className="h-3 w-3"
                checked={checked}
                onChange={() => toggle(o.slug)}
              />
              {o.label}
            </label>
          )
        })}
      </div>
      {warnIfEmpty && value.length === 0 && (
        <p className="mt-2 text-[10px] text-red-700 italic">
          ⚠ Méthode chimique : EPI obligatoires (Arrêté 16/06/2009, art. 4).
        </p>
      )}
    </fieldset>
  )
}
