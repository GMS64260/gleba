"use client"

import * as React from "react"
import Link from "next/link"
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
  AlertTriangle,
  ChevronDown,
  Loader2,
  MapPin,
  Droplets,
  Wind,
} from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { MeteoWidget } from "./MeteoWidget"
import { LunaireWidget } from "@/components/lunaire/LunaireWidget"

interface Parcelle {
  nom: string
  centroidLat: number
  centroidLng: number
}

interface MeteoResume {
  temperature: number
  weatherCode: number
  weatherDescription: string
  humidity: number
  windSpeed: number
  alertCount: number
}

function WeatherIconSmall({ code }: { code: number }) {
  const cls = "h-4 w-4"
  if (code === 0 || code === 1) return <Sun className={`${cls} text-yellow-500`} />
  if (code === 2) return <CloudSun className={`${cls} text-slate-500`} />
  if (code === 3) return <Cloud className={`${cls} text-slate-400`} />
  if (code >= 45 && code <= 48) return <CloudFog className={`${cls} text-slate-400`} />
  if (code >= 51 && code <= 67) return <CloudRain className={`${cls} text-blue-400`} />
  if (code >= 71 && code <= 86) return <CloudSnow className={`${cls} text-blue-200`} />
  if (code >= 95) return <CloudLightning className={`${cls} text-yellow-600`} />
  return <Cloud className={`${cls} text-slate-400`} />
}

export function HeaderMeteoWidget({ showLune = false }: { showLune?: boolean }) {
  const [parcelle, setParcelle] = React.useState<Parcelle | null>(null)
  const [meteo, setMeteo] = React.useState<MeteoResume | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    async function load() {
      try {
        const carteRes = await fetch("/api/carte")
        if (!carteRes.ok) return
        const parcelles = await carteRes.json()
        const p = parcelles.find(
          (x: { centroidLat: number | null; centroidLng: number | null }) =>
            x.centroidLat && x.centroidLng
        )
        if (!p) return
        setParcelle({ nom: p.nom, centroidLat: p.centroidLat, centroidLng: p.centroidLng })

        const meteoRes = await fetch(`/api/meteo?lat=${p.centroidLat}&lng=${p.centroidLng}`)
        if (!meteoRes.ok) return
        const data = await meteoRes.json()
        if (data.actuelle) {
          const alertCount = (data.alertes || []).filter(
            (a: { niveau: string }) => a.niveau === "danger" || a.niveau === "attention"
          ).length
          setMeteo({
            temperature: data.actuelle.temperature,
            weatherCode: data.actuelle.weatherCode,
            weatherDescription: data.actuelle.weatherDescription,
            humidity: data.actuelle.humidity,
            windSpeed: data.actuelle.windSpeed,
            alertCount,
          })
        }
      } catch {
        // silencieux — pas de météo disponible
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center px-2 py-1 text-slate-300">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      </div>
    )
  }

  if (!parcelle || !meteo) return null

  return (
    <div className={`flex items-stretch gap-0 rounded-lg border border-sky-200 overflow-hidden isolate flex-shrink-0`}>
      <Popover>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-2 px-2 py-1.5 sm:gap-2.5 sm:px-3 sm:py-2 bg-sky-50/80 hover:bg-sky-100 transition-colors group">
            <WeatherIconSmall code={meteo.weatherCode} />

            {/* Température + description */}
            <div className="text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-slate-800">{Math.round(meteo.temperature)}°C</span>
                <span className="hidden md:inline text-xs text-slate-500">{meteo.weatherDescription}</span>
              </div>
              <div className="hidden sm:flex items-center gap-0.5 text-[11px] text-slate-400">
                <MapPin className="h-3 w-3 flex-shrink-0" />
                <span className="max-w-[100px] truncate">{parcelle.nom}</span>
              </div>
            </div>

            {/* Humidité + vent */}
            <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-sky-200">
              <span className="flex items-center gap-0.5 text-xs text-blue-500">
                <Droplets className="h-3.5 w-3.5" />
                {meteo.humidity}%
              </span>
              <span className="flex items-center gap-0.5 text-xs text-slate-500">
                <Wind className="h-3.5 w-3.5" />
                {Math.round(meteo.windSpeed)} km/h
              </span>
            </div>

            {/* Alertes */}
            {meteo.alertCount > 0 && (
              <span className="flex items-center gap-0.5 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
                <AlertTriangle className="h-3 w-3" />
                {meteo.alertCount}
              </span>
            )}

            <ChevronDown className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[380px] p-0" align="start" sideOffset={8}>
          <MeteoWidget lat={parcelle.centroidLat} lng={parcelle.centroidLng} />
          {/* Palier 3 : la météo a désormais une page dédiée */}
          <div className="border-t px-3 py-2 text-right">
            <Link
              href="/meteo"
              className="text-xs font-medium text-sky-700 hover:text-sky-900 hover:underline underline-offset-2"
            >
              Ouvrir la page Météo →
            </Link>
          </div>
        </PopoverContent>
      </Popover>

      {showLune && (
        <div className="border-l border-sky-200">
          <LunaireWidget embedded />
        </div>
      )}
    </div>
  )
}
