"use client"

import * as React from "react"
import {
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Sun,
  CloudSun,
  CloudFog,
  Droplets,
  Wind,
  Thermometer,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Loader2,
  MapPin,
  Tractor,
  ShieldCheck,
  PawPrint,
  Trees,
} from "lucide-react"

// ============================================================
// TYPES
// ============================================================

interface MeteoActuelle {
  temperature: number
  humidity: number
  windSpeed: number
  precipitation: number
  weatherCode: number
  weatherDescription: string
}

interface MeteoPrevision {
  date: string
  tempMin: number
  tempMax: number
  precipitation: number
  precipitationProba: number
  sunshine: number
  windSpeedMax: number
}

interface AlerteMeteo {
  type: string
  niveau: "info" | "attention" | "danger"
  date: string
  message: string
  details: string
  parcelle?: { id: string; nom: string }
}

interface EnsoleillementResume {
  totalHeures: number
  moyenneJour: number
  joursSoleil: number
  joursGris: number
}

interface MeteoHistorique {
  date: string
  precipitation: number
}

interface MeteoData {
  parcelle: { id: string; nom: string; lat: number; lng: number }
  actuelle: MeteoActuelle | null
  previsions: MeteoPrevision[]
  historique7j: MeteoHistorique[]
  alertes: AlerteMeteo[]
  ensoleillement: EnsoleillementResume
  source: string
}

// Graphique de pluviométrie : historique 7j + prévisions 7j
function PluieGraph({ historique, previsions }: { historique: MeteoHistorique[]; previsions: MeteoPrevision[] }) {
  const barres = [
    ...historique.map(d => ({ date: d.date, mm: d.precipitation, prevu: false })),
    ...previsions.slice(0, 7).map(d => ({ date: d.date, mm: d.precipitation, prevu: true })),
  ]
  if (barres.length === 0) return null

  const maxMm = Math.max(...barres.map(b => b.mm), 5)
  const w = 14, gap = 2, h = 40

  function jourLabel(dateStr: string, i: number) {
    const d = new Date(dateStr + "T00:00:00")
    if (i === historique.length - 1) return "Auj."
    return d.toLocaleDateString("fr-FR", { weekday: "short" }).slice(0, 3)
  }

  const total7jPasse = historique.reduce((s, d) => s + d.precipitation, 0)
  const total7jPrevu = previsions.slice(0, 7).reduce((s, d) => s + d.precipitation, 0)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10px] text-slate-400">
        <span>↓ {Math.round(total7jPasse)} mm (7j)</span>
        <span className="text-blue-400">~ {Math.round(total7jPrevu)} mm prévus</span>
      </div>
      <div className="overflow-x-auto">
        <svg
          width={barres.length * (w + gap) - gap}
          height={h + 20}
          style={{ display: "block" }}
        >
          {barres.map((b, i) => {
            const barH = Math.max(2, (b.mm / maxMm) * h)
            const x = i * (w + gap)
            const y = h - barH
            const isSep = i === historique.length
            return (
              <g key={b.date}>
                {isSep && (
                  <line x1={x - gap / 2} y1={0} x2={x - gap / 2} y2={h + 16} stroke="#e5e7eb" strokeWidth={1} strokeDasharray="2,2" />
                )}
                <rect
                  x={x} y={y} width={w} height={barH}
                  fill={b.prevu ? "#93c5fd" : "#3b82f6"}
                  rx={2}
                  opacity={b.prevu ? 0.7 : 1}
                />
                {b.mm >= 2 && (
                  <text x={x + w / 2} y={y - 1} textAnchor="middle" fontSize={7} fill="#374151">
                    {Math.round(b.mm)}
                  </text>
                )}
                <text x={x + w / 2} y={h + 13} textAnchor="middle" fontSize={7} fill={b.prevu ? "#60a5fa" : "#9ca3af"}>
                  {jourLabel(b.date, i)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      <div className="flex items-center gap-3 text-[10px] text-slate-400">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-500" /> Passé
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-300 opacity-70" /> Prévu
        </span>
      </div>
    </div>
  )
}

// ============================================================
// ICONES METEO
// ============================================================

function WeatherIcon({ code, className = "h-5 w-5" }: { code: number; className?: string }) {
  if (code === 0 || code === 1) return <Sun className={`${className} text-yellow-500`} />
  if (code === 2) return <CloudSun className={`${className} text-slate-500`} />
  if (code === 3) return <Cloud className={`${className} text-slate-400`} />
  if (code >= 45 && code <= 48) return <CloudFog className={`${className} text-slate-400`} />
  if (code >= 51 && code <= 67) return <CloudRain className={`${className} text-blue-400`} />
  if (code >= 71 && code <= 86) return <CloudSnow className={`${className} text-blue-200`} />
  if (code >= 95) return <CloudLightning className={`${className} text-yellow-600`} />
  return <Cloud className={`${className} text-slate-400`} />
}

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================

interface MeteoWidgetProps {
  parcelleId?: string
  lat?: number
  lng?: number
  compact?: boolean
  defaultExpanded?: boolean
}

export function MeteoWidget({ parcelleId, lat, lng, compact = false, defaultExpanded = false }: MeteoWidgetProps) {
  const [data, setData] = React.useState<MeteoData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [expanded, setExpanded] = React.useState(defaultExpanded)

  React.useEffect(() => {
    async function fetchMeteo() {
      try {
        setLoading(true)
        setError(null)

        let url = "/api/meteo?"
        if (parcelleId) {
          url += `parcelleId=${parcelleId}`
        } else if (lat && lng) {
          url += `lat=${lat}&lng=${lng}`
        } else {
          setError("Aucune parcelle ou coordonnees fournies")
          setLoading(false)
          return
        }

        const res = await fetch(url)
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || "Erreur API meteo")
        }

        setData(await res.json())
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Erreur API météo")
      } finally {
        setLoading(false)
      }
    }

    fetchMeteo()
  }, [parcelleId, lat, lng])

  if (loading) {
    return (
      <div className="border rounded-lg p-4 bg-white">
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Chargement meteo...</span>
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

  if (!data || !data.actuelle) return null

  const { actuelle, previsions, alertes, ensoleillement } = data
  const dangers = alertes.filter(a => a.niveau === "danger" || a.niveau === "attention")
  const prochainsJours = previsions.slice(0, 5)
  const traitement = prochainsJours.find(j => j.windSpeedMax < 19 && j.precipitation < 1)
  const recolte = prochainsJours.find(j => j.precipitation < 1 && j.precipitationProba < 30 && j.windSpeedMax < 35)
  const chaleur = Math.max(...prochainsJours.map(j => j.tempMax), -Infinity)
  const gel = prochainsJours.find(j => j.tempMin <= 2)
  const jourCourt = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" })

  return (
    <div className="border rounded-lg bg-white overflow-hidden">
      {/* En-tete compact */}
      <div
        className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <WeatherIcon code={actuelle.weatherCode} className="h-8 w-8" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-semibold">{Math.round(actuelle.temperature)}°C</span>
              <span className="text-sm text-slate-500">{actuelle.weatherDescription}</span>
            </div>
            <div className="flex items-center gap-0.5 text-xs text-slate-400 mt-0.5">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span className="truncate max-w-[160px]">{data.parcelle.nom}</span>
            </div>
            {!compact && (
              <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                <span className="flex items-center gap-0.5">
                  <Droplets className="h-3 w-3" />
                  {actuelle.humidity}%
                </span>
                <span className="flex items-center gap-0.5">
                  <Wind className="h-3 w-3" />
                  {Math.round(actuelle.windSpeed)} km/h
                </span>
                <span className="flex items-center gap-0.5">
                  <Sun className="h-3 w-3" />
                  {ensoleillement.moyenneJour}h/j
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {dangers.length > 0 && (
            <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
              <AlertTriangle className="h-3 w-3" />
              {dangers.length}
            </span>
          )}
          {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </div>
      </div>

      {/* Contenu etendu */}
      {expanded && (
        <div className="border-t">
          <div className="px-3 py-3 bg-emerald-50/50 border-b">
            <p className="text-xs font-semibold text-emerald-900 flex items-center gap-2 mb-2"><Tractor className="h-4 w-4" /> Fenêtres de travail · 5 jours</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-md border bg-white p-2 text-xs"><p className="font-medium flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Traitement</p><p className="text-slate-500 mt-0.5">{traitement ? `${jourCourt(traitement.date)} · vent ${Math.round(traitement.windSpeedMax)} km/h, pluie ${traitement.precipitation.toFixed(1)} mm` : "Aucune fenêtre favorable"}</p></div>
              <div className="rounded-md border bg-white p-2 text-xs"><p className="font-medium flex items-center gap-1"><Tractor className="h-3.5 w-3.5 text-amber-600" /> Récolte / foin</p><p className="text-slate-500 mt-0.5">{recolte ? `${jourCourt(recolte.date)} · fenêtre sèche, risque pluie ${Math.round(recolte.precipitationProba)} %` : "Pas de créneau sec assez fiable"}</p></div>
              <div className="rounded-md border bg-white p-2 text-xs"><p className="font-medium flex items-center gap-1"><PawPrint className="h-3.5 w-3.5 text-orange-600" /> Élevage</p><p className="text-slate-500 mt-0.5">{chaleur >= 30 ? `Pic ${Math.round(chaleur)}°C · sécuriser eau, ombre, ventilation` : `Pic ${Math.round(chaleur)}°C · stress thermique limité`}</p></div>
              <div className="rounded-md border bg-white p-2 text-xs"><p className="font-medium flex items-center gap-1"><Trees className="h-3.5 w-3.5 text-lime-700" /> Verger / plants</p><p className="text-slate-500 mt-0.5">{gel ? `${jourCourt(gel.date)} · ${Math.round(gel.tempMin)}°C, préparer les protections` : "Pas de gel proche détecté"}</p></div>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">Aide à la décision : confirmer les conditions sur la parcelle avant intervention.</p>
          </div>
          {/* Alertes */}
          {dangers.length > 0 && (
            <div className="px-3 py-2 space-y-1.5">
              {dangers.map((a, i) => (
                <div
                  key={i}
                  className={`text-xs p-2 rounded ${
                    a.niveau === "danger"
                      ? "bg-red-50 text-red-700 border border-red-200"
                      : "bg-amber-50 text-amber-700 border border-amber-200"
                  }`}
                >
                  <p className="font-medium">{a.message}</p>
                  <p className="mt-0.5 opacity-80">{a.details}</p>
                </div>
              ))}
            </div>
          )}

          {/* Previsions 7 jours */}
          <div className="px-3 py-2">
            <p className="text-xs font-medium text-slate-500 mb-2">Previsions 7 jours</p>
            <div className="grid grid-cols-7 gap-1">
              {previsions.slice(0, 7).map((jour, i) => {
                const date = new Date(jour.date)
                const jourSemaine = date.toLocaleDateString("fr-FR", { weekday: "short" }).slice(0, 3)
                return (
                  <div key={i} className="text-center">
                    <p className="text-[10px] text-slate-400 uppercase">{i === 0 ? "Auj." : jourSemaine}</p>
                    <div className="flex justify-center my-0.5">
                      {jour.precipitation > 5 ? (
                        <CloudRain className="h-4 w-4 text-blue-400" />
                      ) : jour.precipitation > 0.5 ? (
                        <CloudSun className="h-4 w-4 text-slate-400" />
                      ) : (
                        <Sun className="h-4 w-4 text-yellow-400" />
                      )}
                    </div>
                    <p className="text-xs font-medium">
                      <span className="text-slate-700">{Math.round(jour.tempMax)}°</span>
                    </p>
                    <p className="text-[10px] text-slate-400">{Math.round(jour.tempMin)}°</p>
                    {jour.precipitation > 0.5 && (
                      <p className="text-[10px] text-blue-500">{Math.round(jour.precipitation)}mm</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Pluviométrie */}
          {(data.historique7j?.length > 0 || previsions.length > 0) && (
            <div className="px-3 py-2 border-t">
              <p className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1">
                <CloudRain className="h-3.5 w-3.5 text-blue-400" />
                Pluviométrie (7j passés + 7j prévus)
              </p>
              <PluieGraph historique={data.historique7j ?? []} previsions={previsions} />
            </div>
          )}

          {/* Resume ensoleillement */}
          <div className="px-3 py-2 border-t bg-slate-50">
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <Sun className="h-4 w-4 mx-auto text-yellow-500 mb-0.5" />
                <p className="text-xs font-medium">{ensoleillement.moyenneJour}h/j</p>
                <p className="text-[10px] text-slate-400">Ensoleillement</p>
              </div>
              <div>
                <Thermometer className="h-4 w-4 mx-auto text-orange-500 mb-0.5" />
                <p className="text-xs font-medium">
                  {previsions[0] ? `${Math.round(previsions[0].tempMax)}°` : "-"}
                </p>
                <p className="text-[10px] text-slate-400">Max aujourd&apos;hui</p>
              </div>
              <div>
                <Droplets className="h-4 w-4 mx-auto text-blue-500 mb-0.5" />
                <p className="text-xs font-medium">
                  {Math.round(previsions.slice(0, 3).reduce((s, d) => s + d.precipitation, 0))}mm
                </p>
                <p className="text-[10px] text-slate-400">Pluie 3j</p>
              </div>
              <div>
                <Wind className="h-4 w-4 mx-auto text-slate-500 mb-0.5" />
                <p className="text-xs font-medium">
                  {previsions[0] ? `${Math.round(previsions[0].windSpeedMax)}` : "-"} km/h
                </p>
                <p className="text-[10px] text-slate-400">Vent max</p>
              </div>
            </div>
          </div>

          {/* Source */}
          <div className="px-3 py-1.5 border-t">
            <p className="text-[10px] text-slate-300">
              Source : {data.source} | {data.parcelle.nom} ({data.parcelle.lat.toFixed(2)}, {data.parcelle.lng.toFixed(2)})
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
