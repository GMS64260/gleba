"use client"

import * as React from "react"
import {
  Droplets,
  AlertTriangle,
  CheckCircle2,
  CloudRain,
  Loader2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Waves,
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
} from "lucide-react"

// ============================================================
// TYPES
// ============================================================

interface RecommandationIrrigation {
  cultureId: number
  cultureName: string
  plancheName: string
  urgence: "critique" | "haute" | "moyenne" | "faible" | "aucune"
  bilanHydrique7j: number
  pluiePrevue48h: number
  conseilQuantite: number
  conseilMessage: string
  prochainePluie: string | null
  joursSansPluie: number
}

interface IrrigationData {
  recommandations: RecommandationIrrigation[]
  total: number
  urgentes: number
  cached: boolean
  cachedAt: string
  cacheAgeMinutes: number
}

// ============================================================
// COMPOSANT
// ============================================================

interface NappeData {
  station: { code: string; commune: string; departement: string; distance_km: number }
  nappe: {
    niveauActuel: number | null
    profondeurActuelle: number | null
    tendance: "hausse" | "baisse" | "stable" | "inconnue"
    variationMensuelle: number | null
    dateReleve: string | null
  }
}

interface IrrigationAdvisorProps {
  parcelleId?: string
  lat?: number
  lng?: number
}

export function IrrigationAdvisor({ parcelleId, lat, lng }: IrrigationAdvisorProps) {
  const [data, setData] = React.useState<IrrigationData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [collapsed, setCollapsed] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [showAll, setShowAll] = React.useState(false)
  const [nappeData, setNappeData] = React.useState<NappeData | null>(null)

  const fetchRecos = React.useCallback(async (forceRefresh = false) => {
    try {
      if (forceRefresh) setRefreshing(true)
      else setLoading(true)

      let url = "/api/meteo/irrigation"
      const params = new URLSearchParams()
      if (parcelleId) params.set('parcelleId', parcelleId)
      if (forceRefresh) params.set('refresh', '1')
      if (params.toString()) url += `?${params}`

      const res = await fetch(url)
      if (!res.ok) throw new Error("Erreur API")
      setData(await res.json())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [parcelleId])

  React.useEffect(() => {
    fetchRecos()
  }, [fetchRecos])

  // Fetch donnees nappe phreatique
  React.useEffect(() => {
    if (!lat || !lng) {
      fetch("/api/carte")
        .then((r) => r.json())
        .then((parcelles) => {
          const arr = parcelles.data || parcelles || []
          const first = arr.find((p: any) => p.centroidLat && p.centroidLng)
          if (first) {
            fetch(`/api/meteo/nappe?lat=${first.centroidLat}&lng=${first.centroidLng}`)
              .then((r) => (r.ok ? r.json() : null))
              .then((d) => d && setNappeData(d))
              .catch(() => {})
          }
        })
        .catch(() => {})
    } else {
      fetch(`/api/meteo/nappe?lat=${lat}&lng=${lng}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setNappeData(d))
        .catch(() => {})
    }
  }, [lat, lng])

  if (loading) {
    return (
      <div className="border rounded-lg p-4 bg-white">
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Analyse irrigation en cours...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="border rounded-lg p-4 bg-white">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    )
  }

  if (!data || data.recommandations.length === 0) {
    return (
      <div className="border rounded-lg p-4 bg-white">
        <div className="flex items-center gap-2 text-slate-500">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <span className="text-sm">Aucune culture active necessitant une analyse d&apos;irrigation.</span>
        </div>
      </div>
    )
  }

  // Compter celles qui n'ont pas besoin d'arrosage
  const okCount = data.recommandations.filter(r => r.urgence === 'aucune').length
  const displayed = showAll ? data.recommandations : data.recommandations.slice(0, 5)

  return (
    <div className="border rounded-lg bg-white overflow-hidden">
      {/* En-tete — cliquable pour réduire/agrandir */}
      <div
        className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition-colors select-none"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2">
          <Droplets className="h-5 w-5 text-blue-500" />
          <div>
            <span className="font-medium text-sm">Conseils irrigation</span>
            {data.cachedAt && (
              <p className="text-[10px] text-slate-400 leading-none mt-0.5">
                {data.cached
                  ? `Calculé il y a ${data.cacheAgeMinutes} min`
                  : "Calculé à l'instant"}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {okCount > 0 && (
            <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
              {okCount} OK
            </span>
          )}
          {data.urgentes > 0 && (
            <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full">
              {data.urgentes} urgente{data.urgentes > 1 ? "s" : ""}
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); fetchRecos(true) }}
            disabled={refreshing}
            className="p-1 rounded hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600 disabled:opacity-40"
            title="Recalculer maintenant"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          {collapsed ? (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </div>

      {!collapsed && <>
      {/* Nappe phreatique — masquer si relevé trop ancien (> 2 ans). Bug
          feedback testeur 2026-05-26 (cmpm73mgd) — un relevé > 3 mois est
          déjà périmé pour piloter l'irrigation : on affiche un bandeau
          d'avertissement coloré (ambre) au lieu de l'info en cyan rassurant. */}
      {nappeData && nappeData.nappe.dateReleve && (Date.now() - new Date(nappeData.nappe.dateReleve).getTime()) < 2 * 365 * 86400000 && (() => {
        const ageMs = Date.now() - new Date(nappeData.nappe.dateReleve!).getTime()
        const ageMois = Math.floor(ageMs / (30 * 86400000))
        const isStale = ageMs > 90 * 86400000 // > 3 mois
        return (
        <div className={`px-3 py-2 border-b ${isStale ? 'bg-amber-50' : 'bg-cyan-50/50'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Waves className={`h-4 w-4 ${isStale ? 'text-amber-600' : 'text-cyan-600'}`} />
              <div>
                <p className={`text-xs font-medium ${isStale ? 'text-amber-800' : 'text-cyan-800'}`}>
                  Nappe : {nappeData.station.commune}
                  <span className={`font-normal ml-1 ${isStale ? 'text-amber-500' : 'text-cyan-500'}`}>({nappeData.station.distance_km} km)</span>
                  {isStale && (
                    <span className="ml-2 text-[10px] uppercase tracking-wide font-bold text-amber-700">⚠ Donnée périmée</span>
                  )}
                </p>
                {nappeData.nappe.dateReleve && (
                  <p className={`text-[10px] ${isStale ? 'text-amber-600' : 'text-cyan-500'}`}>
                    Relevé du {new Date(nappeData.nappe.dateReleve).toLocaleDateString("fr-FR")}
                    {isStale && ` — ${ageMois} mois, ne pas utiliser pour piloter l'arrosage`}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {nappeData.nappe.profondeurActuelle !== null && (
                <span className="text-xs font-medium text-cyan-700">
                  -{nappeData.nappe.profondeurActuelle.toFixed(1)}m
                </span>
              )}
              {nappeData.nappe.tendance === "hausse" && (
                <span title="En hausse"><TrendingUp className="h-3.5 w-3.5 text-green-600" /></span>
              )}
              {nappeData.nappe.tendance === "baisse" && (
                <span title="En baisse"><TrendingDown className="h-3.5 w-3.5 text-red-500" /></span>
              )}
              {nappeData.nappe.tendance === "stable" && (
                <span title="Stable"><Minus className="h-3.5 w-3.5 text-slate-400" /></span>
              )}
              {nappeData.nappe.variationMensuelle !== null && (
                <span className={`text-[10px] ${
                  nappeData.nappe.variationMensuelle < -0.5 ? "text-red-500" :
                  nappeData.nappe.variationMensuelle > 0.5 ? "text-green-600" : "text-slate-400"
                }`}>
                  {nappeData.nappe.variationMensuelle > 0 ? "+" : ""}{nappeData.nappe.variationMensuelle}m/mois
                </span>
              )}
            </div>
          </div>
        </div>
        )
      })()}

      {/* Nappe trop ancienne — avertissement discret */}
      {nappeData && nappeData.nappe.dateReleve && (Date.now() - new Date(nappeData.nappe.dateReleve).getTime()) >= 2 * 365 * 86400000 && (
        <div className="px-3 py-1.5 border-b bg-slate-50 flex items-center gap-2">
          <Info className="h-3.5 w-3.5 text-slate-400" />
          <p className="text-[10px] text-slate-400">
            Nappe ({nappeData.station.commune}) : dernier relevé trop ancien ({new Date(nappeData.nappe.dateReleve).toLocaleDateString("fr-FR")})
          </p>
        </div>
      )}

      {/* Recommandations */}
      <div className="divide-y">
        {displayed.map((reco) => (
          <RecoRow key={reco.cultureId} reco={reco} />
        ))}
      </div>

      {/* Voir plus */}
      {data.recommandations.length > 5 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 flex items-center justify-center gap-1 border-t"
        >
          {showAll ? (
            <>
              <ChevronUp className="h-3 w-3" /> Voir moins
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" /> Voir les {data.recommandations.length - 5} autres
            </>
          )}
        </button>
      )}
      </>}
    </div>
  )
}

// ============================================================
// LIGNE DE RECOMMANDATION
// ============================================================

function RecoRow({ reco }: { reco: RecommandationIrrigation }) {
  const [expanded, setExpanded] = React.useState(false)

  const urgenceConfig = {
    critique: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", label: "Critique", icon: AlertTriangle },
    haute: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", label: "Haute", icon: AlertTriangle },
    moyenne: { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200", label: "Moyenne", icon: Droplets },
    faible: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", label: "Faible", icon: Droplets },
    aucune: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", label: "OK", icon: CheckCircle2 },
  }

  const config = urgenceConfig[reco.urgence]
  const Icon = config.icon

  return (
    <div className={`${reco.urgence === "critique" || reco.urgence === "haute" ? config.bg : ""}`}>
      <div
        className="px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={`h-4 w-4 flex-shrink-0 ${config.text}`} />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{reco.cultureName}</p>
            <p className="text-xs text-slate-400 truncate">{reco.plancheName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {reco.pluiePrevue48h > 3 && (
            <span className="text-xs text-blue-500 flex items-center gap-0.5">
              <CloudRain className="h-3 w-3" />
              {Math.round(reco.pluiePrevue48h)}mm
            </span>
          )}
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.bg} ${config.text} border ${config.border}`}>
            {config.label}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-2 pl-9">
          <p className="text-xs text-slate-600 leading-relaxed">{reco.conseilMessage}</p>
          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400">
            <span>Bilan 7j : {reco.bilanHydrique7j > 0 ? "+" : ""}{reco.bilanHydrique7j}mm</span>
            <span>{reco.joursSansPluie}j sans pluie</span>
            {reco.conseilQuantite > 0 && <span className="font-medium text-blue-600">{reco.conseilQuantite} L/m2</span>}
          </div>
        </div>
      )}
    </div>
  )
}
