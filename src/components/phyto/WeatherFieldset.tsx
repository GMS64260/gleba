"use client"

/**
 * DEV3 audit Marc 2026-05-14 - Composant partagé.
 *
 * Bloc Météo réutilisé par :
 * - Registre phyto (BLOQUANT #1)
 * - Formulaire Operations (MAJEUR #6)
 *
 * Champs : Température (°C), Vent (km/h ou échelle Beaufort), Hygrométrie (%),
 * Pluie ±24h (O/N + mm).
 *
 * On expose une "valeur contrôlée" via `value`/`onChange` pour s'intégrer
 * naturellement dans un state form parent. Les champs sont marqués requis
 * via la prop `required` (selon contexte phyto/operation).
 */

import * as React from "react"
import { Cloud, Droplets, Thermometer, Wind } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export interface WeatherData {
  temperatureC: number | null
  ventKmh: number | null
  hygrometriePct: number | null
  pluie24h: boolean | null
  pluie24hMm: number | null
}

export const EMPTY_WEATHER: WeatherData = {
  temperatureC: null,
  ventKmh: null,
  hygrometriePct: null,
  pluie24h: null,
  pluie24hMm: null,
}

interface WeatherFieldsetProps {
  value: WeatherData
  onChange: (next: WeatherData) => void
  /** Si true, marque les 4 sous-champs comme requis (pour le registre phyto). */
  required?: boolean
  /** Légende affichée en titre du fieldset. */
  legend?: string
  /** Active la mention "Arrêté 16/06/2009" en pied du bloc. */
  showLegalHint?: boolean
}

export function WeatherFieldset({
  value,
  onChange,
  required = false,
  legend = "Météo de l'application",
  showLegalHint = false,
}: WeatherFieldsetProps) {
  const setField = <K extends keyof WeatherData>(key: K, v: WeatherData[K]) => {
    onChange({ ...value, [key]: v })
  }

  return (
    <fieldset className="rounded-md border bg-slate-50/60 p-3">
      <legend className="px-2 text-xs font-semibold text-slate-700 flex items-center gap-1">
        <Cloud className="h-3 w-3" />
        {legend}
        {required && <span className="text-red-600">*</span>}
      </legend>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <Label className="text-xs flex items-center gap-1">
            <Thermometer className="h-3 w-3 text-orange-500" />
            Température (°C)
          </Label>
          <Input
            type="number"
            step="0.5"
            value={value.temperatureC ?? ""}
            onChange={(e) =>
              setField("temperatureC", e.target.value === "" ? null : parseFloat(e.target.value))
            }
            placeholder="15"
          />
        </div>

        <div>
          <Label className="text-xs flex items-center gap-1">
            <Wind className="h-3 w-3 text-sky-500" />
            Vent (km/h)
          </Label>
          <Input
            type="number"
            step="0.5"
            value={value.ventKmh ?? ""}
            onChange={(e) =>
              setField("ventKmh", e.target.value === "" ? null : parseFloat(e.target.value))
            }
            placeholder="< 19"
          />
        </div>

        <div>
          <Label className="text-xs flex items-center gap-1">
            <Droplets className="h-3 w-3 text-blue-500" />
            Hygrométrie (%)
          </Label>
          <Input
            type="number"
            min={0}
            max={100}
            step={1}
            value={value.hygrometriePct ?? ""}
            onChange={(e) =>
              setField("hygrometriePct", e.target.value === "" ? null : parseInt(e.target.value, 10))
            }
            placeholder="60"
          />
        </div>

        <div>
          <Label className="text-xs">
            Pluie ±24h{required && <span className="text-red-600"> *</span>}
          </Label>
          <div className="flex gap-2">
            {/* Bug bloquant phyto (2026-05-29) — l'ancien `<select required>` natif
                contrôlé ne committait pas sa valeur de façon fiable et, surtout,
                la validation HTML5 native bloquait la soumission EN SILENCE (aucun
                POST, le toast « champs manquants » ne se déclenchait jamais). On le
                remplace par des boutons-toggle : un vrai onClick commit toujours la
                valeur, et la validation passe désormais par le serveur (toast visible). */}
            <div className="flex gap-1" role="radiogroup" aria-label="Pluie dans les ±24h">
              {([
                { v: false, label: "Non" },
                { v: true, label: "Oui" },
              ] as const).map((opt) => {
                const active = value.pluie24h === opt.v
                return (
                  <button
                    key={opt.label}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() =>
                      onChange({
                        ...value,
                        pluie24h: opt.v,
                        pluie24hMm: opt.v ? value.pluie24hMm : null,
                      })
                    }
                    className={`h-9 px-3 rounded-md border text-xs transition-colors ${
                      active
                        ? "bg-sky-600 text-white border-sky-600"
                        : "bg-background hover:bg-slate-100 border-input"
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
            {value.pluie24h === true && (
              <Input
                type="number"
                step="0.5"
                value={value.pluie24hMm ?? ""}
                onChange={(e) =>
                  setField(
                    "pluie24hMm",
                    e.target.value === "" ? null : parseFloat(e.target.value)
                  )
                }
                placeholder="mm"
                className="w-20"
              />
            )}
          </div>
        </div>
      </div>

      {showLegalHint && (
        <p className="mt-2 text-[10px] text-slate-500 italic">
          Conditions d'application (Arrêté 16/06/2009 modifié) : vent ≤ 19 km/h
          (Force 3 Beaufort), pas de précipitations dans les 24h. Saisie obligatoire
          pour les produits chimiques.
        </p>
      )}
    </fieldset>
  )
}
