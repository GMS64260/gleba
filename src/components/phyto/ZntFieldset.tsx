"use client"

/**
 * DEV3 audit Marc 2026-05-14 - Bloc ZNT.
 *
 * ZNT = Zone Non Traitée (Arrêté 12/09/2006 puis 16/06/2009).
 * Distance minimale réglementaire vis-à-vis des cours d'eau : 5 m par défaut,
 * 20 m ou 50 m selon le produit (cf. AMM E-Phy). Le produit peut imposer plus.
 */

import * as React from "react"
import { Waves } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface ZntFieldsetProps {
  /** Distance ZNT effective déclarée par l'opérateur (m). */
  distanceM: number | null
  respectee: boolean | null
  onChange: (next: { distanceM: number | null; respectee: boolean | null }) => void
  /** ZNT minimale imposée par le produit (AMM). Affichée à titre indicatif. */
  zntProduitM?: number | null
  required?: boolean
}

export function ZntFieldset({ distanceM, respectee, onChange, zntProduitM, required = false }: ZntFieldsetProps) {
  const seuil = zntProduitM ?? 5
  const okAuto = distanceM != null ? distanceM >= seuil : null
  // On dérive `respectee` automatiquement quand l'utilisateur saisit une
  // distance, mais on garde la possibilité de surcharge manuelle.
  const effectif = respectee ?? okAuto

  return (
    <fieldset className="rounded-md border bg-slate-50/60 p-3">
      <legend className="px-2 text-xs font-semibold text-slate-700 flex items-center gap-1">
        <Waves className="h-3 w-3 text-cyan-600" />
        ZNT cours d'eau
        {required && <span className="text-red-600">*</span>}
      </legend>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Distance effective (m)</Label>
          <Input
            type="number"
            min={0}
            step="0.5"
            value={distanceM ?? ""}
            onChange={(e) => {
              const v = e.target.value === "" ? null : parseFloat(e.target.value)
              onChange({
                distanceM: v,
                respectee: v == null ? respectee : v >= seuil,
              })
            }}
            placeholder={`min ${seuil}m`}
            required={required}
          />
        </div>
        <div>
          <Label className="text-xs">ZNT respectée</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
            value={effectif == null ? "" : effectif ? "oui" : "non"}
            onChange={(e) => {
              const next = e.target.value
              onChange({
                distanceM,
                respectee: next === "" ? null : next === "oui",
              })
            }}
            required={required}
          >
            <option value="">—</option>
            <option value="oui">Oui</option>
            <option value="non">Non (signaler)</option>
          </select>
        </div>
      </div>
      {zntProduitM != null && (
        <p className="mt-2 text-[10px] text-slate-500 italic">
          ZNT imposée par l'AMM produit : <strong>{zntProduitM} m</strong>.
        </p>
      )}
      {effectif === false && (
        <p className="mt-2 text-[10px] text-red-700 italic">
          ⚠ ZNT non respectée — manquement traçable (Arrêté 12/09/2006).
        </p>
      )}
    </fieldset>
  )
}
