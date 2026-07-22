"use client"

/**
 * Composant PluviometriePlanche
 * Affiche la pluviométrie (historique 30j + prévisions 7j) pour une planche.
 * Les planches sous abri (Serre, Tunnel, Châssis) affichent un message adapté.
 */

import * as React from "react"
import { CloudRain, Droplets, House, Loader2, TrendingUp, CalendarDays } from "lucide-react"
import type { PluviometriePlancheResponse } from "@/app/api/meteo/pluviometrie/route"

interface Props {
  plancheId: string
  /** Optionnel : type de la planche déjà connu pour éviter d'attendre l'API */
  typePlanche?: string | null
}

// Couleur d'une barre selon la quantité de pluie
function barColor(mm: number, isPrevi: boolean): string {
  if (isPrevi) return mm >= 5 ? "#3b82f6" : mm >= 1 ? "#93c5fd" : "#dbeafe"
  return mm >= 10 ? "#1d4ed8" : mm >= 5 ? "#3b82f6" : mm >= 1 ? "#60a5fa" : "#e5e7eb"
}

// Graphique en barres SVG pour les précipitations
function PluieBarChart({
  historique,
  previsions,
}: {
  historique: { date: string; mm: number }[]
  previsions: { date: string; mm: number; proba: number }[]
}) {
  const all = [
    ...historique.slice(-14).map(d => ({ ...d, isPrevi: false })),
    ...previsions.slice(0, 7).map(d => ({ ...d, isPrevi: true })),
  ]
  if (all.length === 0) return null

  const maxMm = Math.max(...all.map(d => d.mm), 1)
  const w = 16
  const gap = 2
  const h = 60
  const totalW = all.length * (w + gap) - gap

  function formatDateShort(dateStr: string) {
    const d = new Date(dateStr + "T00:00:00")
    return `${d.getDate()}/${d.getMonth() + 1}`
  }

  return (
    <div className="w-full overflow-x-auto">
      <svg
        width={totalW}
        height={h + 18}
        style={{ display: "block", minWidth: totalW }}
        aria-label="Graphique pluviométrie"
      >
        {all.map((d, i) => {
          const barH = Math.max(2, (d.mm / maxMm) * h)
          const x = i * (w + gap)
          const y = h - barH
          const isToday = i === historique.slice(-14).length - 1
          return (
            <g key={d.date}>
              <rect
                x={x}
                y={y}
                width={w}
                height={barH}
                fill={barColor(d.mm, d.isPrevi)}
                rx={2}
                opacity={d.isPrevi ? 0.75 : 1}
              />
              {isToday && (
                <line
                  x1={x + w + gap / 2}
                  y1={0}
                  x2={x + w + gap / 2}
                  y2={h + 14}
                  stroke="#94a3b8"
                  strokeWidth={1}
                  strokeDasharray="3,2"
                />
              )}
              {d.mm >= 1 && (
                <text
                  x={x + w / 2}
                  y={y - 2}
                  textAnchor="middle"
                  fontSize={8}
                  fill="#374151"
                >
                  {d.mm >= 10 ? Math.round(d.mm) : d.mm}
                </text>
              )}
              {(i === 0 || i === 7 || i === all.length - 1 || d.mm >= 5) && (
                <text
                  x={x + w / 2}
                  y={h + 14}
                  textAnchor="middle"
                  fontSize={8}
                  fill={d.isPrevi ? "#3b82f6" : "#6b7280"}
                >
                  {formatDateShort(d.date)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#3b82f6" }} />
          Passé
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#93c5fd", opacity: 0.75 }} />
          Prévu
        </span>
      </div>
    </div>
  )
}

export function PluviometriePlanche({ plancheId }: Props) {
  const [data, setData] = React.useState<PluviometriePlancheResponse | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    setData(null)

    fetch(`/api/meteo/pluviometrie?plancheId=${encodeURIComponent(plancheId)}`, { signal: controller.signal })
      .then(async r => {
        // Audit #58 : sans vérif r.ok, une 500 (Open-Meteo indisponible) était
        // affichée comme « Coordonnées GPS non renseignées » (message mensonger).
        const d = await r.json().catch(() => null)
        if (!r.ok) {
          setError(d?.error || "Service météo momentanément indisponible")
        } else {
          setData(d)
        }
        setLoading(false)
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setError("Impossible de charger les données de pluie")
        setLoading(false)
      })
    return () => controller.abort()
  }, [plancheId])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Chargement pluviométrie...
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-xs text-muted-foreground italic py-1">{error}</div>
    )
  }

  if (!data) return null

  // Planche sous abri
  if (data.sousAbri) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-slate-50 border border-slate-200 px-3 py-2 text-sm">
        <House className="h-4 w-4 text-slate-400 flex-shrink-0" />
        <div>
          <span className="font-medium text-slate-600">Sous abri</span>
          <span className="text-slate-400 ml-1 text-xs">— pas de précipitations directes</span>
        </div>
      </div>
    )
  }

  // Pas de coordonnées GPS disponibles
  if (!data.pluviometrie) {
    return (
      <div className="text-xs text-muted-foreground italic py-1">
        Coordonnées GPS non configurées — associez une parcelle cadastrale pour voir la pluviométrie.
      </div>
    )
  }

  const p = data.pluviometrie
  const { total7j, total30j, joursSansPluie, prochainePluie, prochaineQuantite, historique, previsions } = p

  function formatDate(dateStr: string) {
    const d = new Date(dateStr + "T00:00:00")
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
  }

  return (
    <div className="space-y-3">
      {/* En-tête */}
      <div className="flex items-center gap-1.5 text-sm font-medium text-blue-700">
        <CloudRain className="h-4 w-4" />
        Pluviométrie{data.parcelleNom ? ` · ${data.parcelleNom}` : ""}
      </div>

      {/* Stats résumées */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md bg-blue-50 border border-blue-100 px-3 py-2 text-center">
          <div className="text-lg font-bold text-blue-700">{total7j} mm</div>
          <div className="text-xs text-blue-500">7 derniers jours</div>
        </div>
        <div className="rounded-md bg-slate-50 border border-slate-100 px-3 py-2 text-center">
          <div className="text-lg font-bold text-slate-700">{total30j} mm</div>
          <div className="text-xs text-slate-500">30 derniers jours</div>
        </div>
      </div>

      {/* Jours sans pluie */}
      {joursSansPluie > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2.5 py-1.5">
          <Droplets className="h-3.5 w-3.5 flex-shrink-0" />
          <span>
            {joursSansPluie === 1
              ? "Pas de pluie significative hier"
              : `${joursSansPluie} jours sans pluie significative`}
          </span>
        </div>
      )}

      {/* Prochaine pluie */}
      {prochainePluie ? (
        <div className="flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-md px-2.5 py-1.5">
          <CalendarDays className="h-3.5 w-3.5 flex-shrink-0" />
          <span>
            Prochaine pluie : <strong>{formatDate(prochainePluie)}</strong> — {prochaineQuantite} mm prévus
          </span>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground italic">
          Aucune pluie significative (≥ 5 mm) prevue dans les 7 jours
        </div>
      )}

      {/* Graphique */}
      {(historique.length > 0 || previsions.length > 0) && (
        <div>
          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            14 jours passés + 7 jours prévus
          </div>
          <PluieBarChart historique={historique} previsions={previsions} />
        </div>
      )}
    </div>
  )
}
