"use client"

/**
 * Page Météo dédiée — chantier UX 2026-07, palier 3.
 *
 * La météo n'existait qu'en widgets dispersés (header, onglets) ; cette page
 * regroupe conditions/prévisions (MeteoWidget) et conseil d'irrigation
 * (IrrigationAdvisor) pour la parcelle choisie. Accessible depuis le popover
 * météo du header sur toutes les pages.
 */

import * as React from "react"
import Link from "next/link"
import { CloudSun, MapPin, Radio, Settings } from "lucide-react"
import { AppHeader, PageToolbar } from "@/components/shell/AppHeader"
import { MeteoWidget } from "@/components/meteo/MeteoWidget"
import { IrrigationAdvisor } from "@/components/meteo/IrrigationAdvisor"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { StationMeteoConfig } from "@/components/meteo/StationMeteoConfig"
import BandeauLocalisationExemple, {
  type LocalisationExempleInfo,
} from "@/components/carte/BandeauLocalisationExemple"
import { updateDashboardSearchParams } from "@/lib/dashboard-navigation"
const PARCELLE_METEO_KEY = "gleba_meteo_parcelle"

interface ParcelleMeteo {
  id: string
  nom: string
  surface: number | null
  centroidLat: number
  centroidLng: number
}

interface StationMeteo {
  id: string
  nom: string
  stationId: string
  active: boolean
}

export default function MeteoPage() {
  const [parcelles, setParcelles] = React.useState<ParcelleMeteo[]>([])
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [stations, setStations] = React.useState<StationMeteo[]>([])
  const [sourceVersion, setSourceVersion] = React.useState(0)
  // Suivi 2026-08-16 — le bandeau de recalage n'existait que sur /jardin/carte,
  // page que le segment concerné ne visite jamais : il est monté ICI, là où la
  // localisation fausse est consommée (météo, ET0, pluie, nappes Hub'Eau).
  const [localisationExemple, setLocalisationExemple] = React.useState<LocalisationExempleInfo | null>(null)
  const [parcellesVersion, setParcellesVersion] = React.useState(0)
  const [showConfig, setShowConfig] = React.useState(false)

  // Fast-path anti-waterfall (constat QA cmso9z557) : le parcelleId demandé
  // est déjà dans l'URL — le widget météo peut démarrer sans attendre le
  // payload GeoJSON lourd de /api/carte. Lu dans un effect et non au rendu :
  // le 1er rendu client doit rester identique au HTML serveur (React #418).
  const [fastParcelleId, setFastParcelleId] = React.useState<string | null>(null)
  React.useEffect(() => {
    const demandee = new URLSearchParams(window.location.search).get("parcelleId")
    if (demandee) setFastParcelleId(demandee)
  }, [])

  const chargerLocalisationExemple = React.useCallback(() => {
    fetch("/api/carte/localisation-exemple")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: LocalisationExempleInfo | null) => {
        if (data && typeof data.surDecorExemple === "boolean") setLocalisationExemple(data)
      })
      .catch(() => { /* un échec ici n'empêche pas la météo de fonctionner */ })
  }, [])

  React.useEffect(() => {
    chargerLocalisationExemple()
  }, [chargerLocalisationExemple])

  React.useEffect(() => {
    async function load() {
      try {
        const [res, stationRes] = await Promise.all([fetch("/api/carte"), fetch("/api/meteo/station")])
        if (!res.ok) return
        const data = await res.json()
        const avecCoords = (data as Array<{ id: string; nom: string; surface?: number | null; centroidLat: number | null; centroidLng: number | null }>)
          .filter((p) => p.centroidLat && p.centroidLng)
          .map((p) => ({ id: p.id, nom: p.nom, surface: p.surface ?? null, centroidLat: p.centroidLat as number, centroidLng: p.centroidLng as number }))
        setParcelles(avecCoords)
        // QA 2026-07-30 — Le choix de parcelle n'était qu'un état React : après
        // un rechargement on repartait sur la première parcelle, et les
        // conseils d'irrigation changeaient de périmètre sans action de
        // l'utilisateur. On restaure d'abord la parcelle demandée par l'URL.
        if (avecCoords.length > 0) {
          const demandee = new URLSearchParams(window.location.search).get("parcelleId")
          // QA cmsqmf6om — le choix est aussi persisté en localStorage : c'est
          // la clé que lit le bandeau météo du haut de page, qui restait sinon
          // figé sur la première parcelle pendant que cet écran en suivait une
          // autre — deux affichages contradictoires en permanence.
          const memorisee = window.localStorage.getItem(PARCELLE_METEO_KEY)
          const retenue = demandee && avecCoords.some((p) => p.id === demandee)
            ? demandee
            : memorisee && avecCoords.some((p) => p.id === memorisee)
              ? memorisee
              : avecCoords[0].id
          setSelectedId(retenue)
        }
        if (stationRes.ok) setStations((await stationRes.json()).data || [])
      } catch {
        // silencieux — l'état vide guide l'utilisateur
      } finally {
        setLoading(false)
      }
    }
    load()
    // `parcellesVersion` : après un recalage, les centroïdes ont changé et sont
    // passés en props à IrrigationAdvisor — il faut les relire, pas seulement
    // remonter les widgets.
  }, [parcellesVersion])

  const selectionnerParcelle = (id: string) => {
    setSelectedId(id)
    window.localStorage.setItem(PARCELLE_METEO_KEY, id)
    // Le bandeau d'en-tête écoute ce signal pour changer de parcelle sans
    // rechargement (QA cmsqmf6om).
    window.dispatchEvent(new CustomEvent("gleba:parcelle-meteo", { detail: id }))
    const params = new URLSearchParams(window.location.search)
    params.set("parcelleId", id)
    updateDashboardSearchParams(params, "replace")
  }

  const parcelle = parcelles.find((p) => p.id === selectedId) ?? null
  const activeStation = stations.find((s) => s.active)

  // QA cmsnodx00 — l'import cadastral nomme les parcelles « commune - section
  // numéro » sans contrôle d'unicité : 6 options strictement identiques
  // rendaient le sélecteur inutilisable. En cas d'homonymie, on suffixe un
  // rang stable (ordre de la liste) et la surface pour les distinguer.
  const libellesParcelles = React.useMemo(() => {
    const totaux = new Map<string, number>()
    for (const p of parcelles) totaux.set(p.nom, (totaux.get(p.nom) ?? 0) + 1)
    const vus = new Map<string, number>()
    return new Map(
      parcelles.map((p) => {
        if ((totaux.get(p.nom) ?? 0) < 2) return [p.id, p.nom] as const
        const rang = (vus.get(p.nom) ?? 0) + 1
        vus.set(p.nom, rang)
        const surface = p.surface != null ? ` · ${p.surface.toFixed(2)} ha` : ""
        return [p.id, `${p.nom} (${rang})${surface}`] as const
      })
    )
  }, [parcelles])

  async function reloadStations() {
    const res = await fetch("/api/meteo/station")
    if (res.ok) setStations((await res.json()).data || [])
    setSourceVersion((v) => v + 1)
  }

  async function selectSource(value: string) {
    const res = await fetch("/api/meteo/station", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value === "parcelle" ? { id: null, active: false } : { id: value, active: true }),
    })
    if (!res.ok) return
    setStations((current) => current.map((s) => ({ ...s, active: value !== "parcelle" && s.id === value })))
    setSourceVersion((v) => v + 1)
  }

  return (
    <div className="min-h-screen bg-slate-50 aurora-bg-subtle">
      <div className="fixed inset-0 dot-grid opacity-40 pointer-events-none" aria-hidden="true" />
      <AppHeader />
      <BandeauLocalisationExemple
        info={localisationExemple}
        onRecale={() => {
          setLocalisationExemple(null)
          // Relire les centroïdes, puis rejouer les widgets météo/irrigation
          // sur les nouvelles coordonnées.
          setParcellesVersion((v) => v + 1)
          setSourceVersion((v) => v + 1)
        }}
      />
      <PageToolbar>
        <div className="flex items-center gap-2">
          <CloudSun className="h-6 w-6 text-sky-600" />
          <h1 className="text-xl font-bold">Météo</h1>
        </div>
        <div className="flex items-center gap-2">
          {parcelles.length > 1 && selectedId && (
            <Select value={selectedId} onValueChange={selectionnerParcelle}>
              <SelectTrigger className="w-[230px] h-8" title={libellesParcelles.get(selectedId) ?? undefined}>
                <MapPin className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {parcelles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {libellesParcelles.get(p.id) ?? p.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowConfig((v) => !v)}>
              <Settings className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Configurer</span>
          </Button>
        </div>
      </PageToolbar>

      <main className="container mx-auto px-4 py-6 max-w-[1600px]">
        <Card className="mb-4">
          <CardContent className="py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Radio className="h-4 w-4 text-sky-600 shrink-0" />
              <div className="min-w-0"><p className="text-sm font-medium">Source météo de l&apos;exploitation</p><p className="text-xs text-slate-500 truncate">Ce choix s&apos;applique aussi aux alertes et aux conseils d&apos;irrigation.</p></div>
            </div>
            <Select value={activeStation?.id ?? "parcelle"} onValueChange={selectSource}>
              <SelectTrigger className="w-full sm:w-[320px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="parcelle">Prévisions localisées à la parcelle</SelectItem>
                {stations.map((s) => <SelectItem key={s.id} value={s.id}>{s.nom} · {s.stationId}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
        {showConfig && <Card className="mb-4"><CardContent className="py-4"><StationMeteoConfig onStationsChanged={reloadStations} /></CardContent></Card>}
        {/* Pendant le chargement de /api/carte, si l'URL désigne une parcelle,
            le widget météo démarre tout de suite ; seul le conseil d'irrigation
            (qui a besoin des coordonnées) attend la liste. */}
        {loading && fastParcelleId ? (
          <div className="grid gap-4 lg:grid-cols-2 items-start">
            <MeteoWidget key={`meteo-${sourceVersion}-${fastParcelleId}`} parcelleId={fastParcelleId} defaultExpanded />
            <Skeleton className="h-96 w-full" />
          </div>
        ) : loading ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        ) : !parcelle ? (
          <Card>
            <CardContent className="py-10 text-center space-y-3">
              <CloudSun className="h-10 w-10 text-slate-300 mx-auto" />
              <p className="text-sm text-slate-600">
                Aucune parcelle géolocalisée : la météo a besoin d&apos;un point de référence.
              </p>
              <Link href="/parcelles">
                <Button variant="outline" size="sm" className="mt-1">
                  <MapPin className="h-4 w-4 mr-1" />
                  Définir mes parcelles
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2 items-start">
            <MeteoWidget key={`meteo-${sourceVersion}-${parcelle.id}`} parcelleId={parcelle.id} defaultExpanded />
            <IrrigationAdvisor key={`irrigation-${sourceVersion}-${parcelle.id}`} parcelleId={parcelle.id} lat={parcelle.centroidLat} lng={parcelle.centroidLng} scopeLabel={parcelle.nom} />
          </div>
        )}
      </main>
    </div>
  )
}
