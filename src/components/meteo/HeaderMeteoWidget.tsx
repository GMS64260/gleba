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
  id: string
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
  if (code === 0 || code === 1) return <Sun className={`${cls} text-paille`} />
  if (code === 2) return <CloudSun className={`${cls} text-ardoise`} />
  if (code === 3) return <Cloud className={`${cls} text-ardoise`} />
  if (code >= 45 && code <= 48) return <CloudFog className={`${cls} text-ardoise`} />
  if (code >= 51 && code <= 67) return <CloudRain className={`${cls} text-eau`} />
  if (code >= 71 && code <= 86) return <CloudSnow className={`${cls} text-eau`} />
  if (code >= 95) return <CloudLightning className={`${cls} text-ocre`} />
  return <Cloud className={`${cls} text-ardoise`} />
}

export function HeaderMeteoWidget({ showLune = false }: { showLune?: boolean }) {
  const [parcelle, setParcelle] = React.useState<Parcelle | null>(null)
  const [meteo, setMeteo] = React.useState<MeteoResume | null>(null)
  const [loading, setLoading] = React.useState(true)

  // QA cmsqmf6om — le bandeau prenait TOUJOURS la première parcelle
  // géolocalisée, pendant que la page Météo en suivait une autre : les deux
  // affichages se contredisaient en permanence, alors que l'écran promet que
  // ce choix pilote alertes et conseils d'irrigation. Le bandeau lit désormais
  // la même clé que la page Météo, et se recale sans rechargement quand elle
  // change (événement `gleba:parcelle-meteo`).
  const [parcelleDemandee, setParcelleDemandee] = React.useState<string | null>(null)
  React.useEffect(() => {
    setParcelleDemandee(window.localStorage.getItem("gleba_meteo_parcelle"))
    const onChange = (e: Event) => {
      const id = (e as CustomEvent<string>).detail
      if (id) setParcelleDemandee(id)
    }
    window.addEventListener("gleba:parcelle-meteo", onChange)
    return () => window.removeEventListener("gleba:parcelle-meteo", onChange)
  }, [])

  React.useEffect(() => {
    async function load() {
      try {
        const carteRes = await fetch("/api/carte")
        if (!carteRes.ok) return
        const parcelles = await carteRes.json()
        const geolocalisees = parcelles.filter(
          (x: { centroidLat: number | null; centroidLng: number | null }) =>
            x.centroidLat && x.centroidLng
        )
        const p = geolocalisees.find((x: { id: string }) => x.id === parcelleDemandee) ?? geolocalisees[0]
        if (!p) return
        setParcelle({ id: p.id, nom: p.nom, centroidLat: p.centroidLat, centroidLng: p.centroidLng })

        const meteoRes = await fetch(`/api/meteo?parcelleId=${p.id}`)
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
  }, [parcelleDemandee])

  if (loading) {
    return (
      <div className="flex items-center px-2 py-1 text-ardoise/60">
        <Loader2 className="h-3.5 w-3.5 motion-safe:animate-spin" />
      </div>
    )
  }

  if (!parcelle || !meteo) return null

  return (
    <div className="isolate flex flex-shrink-0 items-stretch gap-0 overflow-hidden rounded-lg border border-lin">
      <Popover>
        <PopoverTrigger asChild>
          <button className="group flex items-center gap-2 bg-papier px-2 py-1.5 transition-colors hover:bg-lin-doux sm:gap-2.5 sm:px-3 sm:py-2" aria-label="Météo de la parcelle suivie">
            <WeatherIconSmall code={meteo.weatherCode} />

            {/* Température + description */}
            <div className="text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-encre">{Math.round(meteo.temperature)}°C</span>
                <span className="hidden text-xs text-ardoise md:inline">{meteo.weatherDescription}</span>
              </div>
              <div className="hidden items-center gap-0.5 text-[11px] text-ardoise sm:flex">
                <MapPin className="h-3 w-3 flex-shrink-0" />
                <span className="max-w-[100px] truncate">{parcelle.nom}</span>
              </div>
            </div>

            {/* Humidité + vent */}
            <div className="hidden items-center gap-2 border-l border-lin pl-2 2xl:flex">
              <span className="flex items-center gap-0.5 text-xs text-eau">
                <Droplets className="h-3.5 w-3.5" />
                {meteo.humidity}%
              </span>
              <span className="flex items-center gap-0.5 text-xs text-ardoise">
                <Wind className="h-3.5 w-3.5" />
                {Math.round(meteo.windSpeed)} km/h
              </span>
            </div>

            {/* Alertes */}
            {meteo.alertCount > 0 && (
              <span className="flex items-center gap-0.5 rounded-full border border-paille bg-paille-doux px-1.5 py-0.5 text-xs font-semibold text-ocre">
                <AlertTriangle className="h-3 w-3" />
                {meteo.alertCount}
              </span>
            )}

            <ChevronDown className="h-3.5 w-3.5 text-ardoise group-hover:text-encre" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[calc(100vw-2rem)] max-w-[380px] p-0" align="start" sideOffset={8}>
          <MeteoWidget parcelleId={parcelle.id} />
          {/* Palier 3 : la météo a désormais une page dédiée */}
          <div className="border-t border-lin px-3 py-2 text-right">
            <Link
              href="/meteo"
              className="text-xs font-semibold text-sauge underline-offset-2 hover:underline"
            >
              Ouvrir la page Météo →
            </Link>
          </div>
        </PopoverContent>
      </Popover>

      {showLune && (
        <div className="border-l border-lin">
          <LunaireWidget embedded />
        </div>
      )}
    </div>
  )
}
