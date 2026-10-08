"use client"

/**
 * Saisie d'une période en semaines ISO (début + durée), présentée en dates
 * lisibles : on choisit une semaine de début puis une semaine de fin
 * (« S27 · début juillet »), et le résumé dit « de début juillet à mi-août ».
 *
 * Demande du 2026-10-07 : la période de récolte d'une variété, saisie en
 * « semaine 27 + 6 semaines », n'était pas reconnue comme telle. Sélecteurs
 * natifs (cf. `SelectNatif`) : le champ ne peut pas mentir, quel que soit le
 * mode de saisie. La fin peut précéder le début dans l'année : la période
 * passe alors par janvier (agrumes, kiwi).
 */

import * as React from "react"

import { Label } from "@/components/ui/label"
import { SelectNatif } from "@/components/ui/select-natif"
import {
  OPTIONS_SEMAINES,
  dureeEntreSemaines,
  libellePeriodeSemaines,
  semaineFin,
} from "@/lib/semaines-lisibles"

export interface PeriodeSemainesValeur {
  debut: number | null
  duree: number | null
}

interface PeriodeSemainesFieldProps {
  label: string
  /** Préfixe des id des deux sélecteurs (accessibilité). */
  idPrefix: string
  debut: number | null
  duree: number | null
  onChange: (valeur: PeriodeSemainesValeur) => void
  /** Texte affiché tant qu'aucune semaine n'est choisie. */
  aide?: string
}

export function PeriodeSemainesField({ label, idPrefix, debut, duree, onChange, aide }: PeriodeSemainesFieldProps) {
  const fin = debut ? semaineFin(debut, duree ?? 1) : null

  const changerDebut = (valeur: string) => {
    const nouveauDebut = valeur ? Number(valeur) : null
    if (!nouveauDebut) {
      onChange({ debut: null, duree: null })
      return
    }
    onChange({ debut: nouveauDebut, duree: fin ? dureeEntreSemaines(nouveauDebut, fin) : (duree ?? 1) })
  }

  const changerFin = (valeur: string) => {
    if (!debut || !valeur) return
    onChange({ debut, duree: dureeEntreSemaines(debut, Number(valeur)) })
  }

  return (
    <fieldset className="space-y-1">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor={`${idPrefix}-debut`} className="text-xs text-muted-foreground">
            Début
          </Label>
          <SelectNatif
            id={`${idPrefix}-debut`}
            name={`${idPrefix}-debut`}
            value={debut ?? ""}
            onChange={(e) => changerDebut(e.target.value)}
          >
            <option value="">Non renseignée</option>
            {OPTIONS_SEMAINES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectNatif>
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-fin`} className="text-xs text-muted-foreground">
            Fin
          </Label>
          <SelectNatif
            id={`${idPrefix}-fin`}
            name={`${idPrefix}-fin`}
            value={fin ?? ""}
            disabled={!debut}
            onChange={(e) => changerFin(e.target.value)}
          >
            {!debut && <option value="">Choisir le début</option>}
            {OPTIONS_SEMAINES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectNatif>
        </div>
      </div>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {debut ? libellePeriodeSemaines(debut, duree ?? 1) : (aide ?? "Choisissez la semaine de début, puis celle de fin.")}
      </p>
    </fieldset>
  )
}
