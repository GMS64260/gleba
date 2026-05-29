"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { confirmDialog } from "@/lib/global-dialog"
import {
  Radio,
  Trash2,
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
  ToggleLeft,
  ToggleRight,
} from "lucide-react"

// ============================================================
// TYPES
// ============================================================

interface StationMeteo {
  id: string
  nom: string
  provider: string
  stationId: string
  lat: number | null
  lng: number | null
  active: boolean
  createdAt: string
}

// ============================================================
// COMPOSANT
// ============================================================

export function StationMeteoConfig() {
  const [stations, setStations] = React.useState<StationMeteo[]>([])
  const [loading, setLoading] = React.useState(true)
  const [showForm, setShowForm] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Formulaire
  const [nom, setNom] = React.useState("")
  const [provider, setProvider] = React.useState("ecowitt")
  const [stationId, setStationId] = React.useState("")
  const [apiKey, setApiKey] = React.useState("")
  const [appKey, setAppKey] = React.useState("")
  const [lat, setLat] = React.useState("")
  const [lng, setLng] = React.useState("")

  // Charger les stations
  React.useEffect(() => {
    fetchStations()
  }, [])

  async function fetchStations() {
    try {
      setLoading(true)
      const res = await fetch("/api/meteo/station")
      if (res.ok) {
        const data = await res.json()
        setStations(data.data || [])
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const res = await fetch("/api/meteo/station", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom, provider, stationId, apiKey, appKey, lat, lng }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Erreur")
      }

      // Reset
      setNom("")
      setProvider("ecowitt")
      setStationId("")
      setApiKey("")
      setAppKey("")
      setLat("")
      setLng("")
      setShowForm(false)

      await fetchStations()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!(await confirmDialog("Supprimer cette station ?"))) return
    try {
      const res = await fetch(`/api/meteo/station?id=${id}`, { method: "DELETE" })
      if (!res.ok) setError("Erreur lors de la suppression")
      await fetchStations()
    } catch {
      setError("Erreur reseau lors de la suppression")
    }
  }

  async function handleToggle(id: string, active: boolean) {
    try {
      const res = await fetch("/api/meteo/station", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, active: !active }),
      })
      if (!res.ok) setError("Erreur lors de la mise à jour")
      await fetchStations()
    } catch {
      setError("Erreur reseau lors de la mise à jour")
    }
  }

  const providerLabels: Record<string, string> = {
    ecowitt: "Ecowitt",
    wunderground: "Weather Underground",
    netatmo: "Netatmo",
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-400 py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Chargement des stations...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Radio className="h-4 w-4 text-blue-500" />
            Stations meteo personnelles
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Connectez votre station pour des données ultra-locales
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-3 w-3 mr-1" />
          Ajouter
        </Button>
      </div>

      {/* Liste des stations */}
      {stations.length > 0 ? (
        <div className="space-y-2">
          {stations.map((station) => (
            <div key={station.id} className="flex items-center justify-between p-3 border rounded-lg bg-white">
              <div className="flex items-center gap-3">
                {station.active ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-slate-300" />
                )}
                <div>
                  <p className="text-sm font-medium">{station.nom}</p>
                  <p className="text-xs text-slate-400">
                    {providerLabels[station.provider] || station.provider} - {station.stationId}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleToggle(station.id, station.active)}
                  title={station.active ? "Desactiver" : "Activer"}
                >
                  {station.active ? (
                    <ToggleRight className="h-4 w-4 text-green-500" />
                  ) : (
                    <ToggleLeft className="h-4 w-4 text-slate-400" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(station.id)}
                  className="text-red-400 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400 py-2">Aucune station configuree.</p>
      )}

      {/* Formulaire d'ajout */}
      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-3 p-4 border rounded-lg bg-slate-50">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600">Nom</label>
              <input
                type="text"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Ma station jardin"
                className="w-full mt-1 px-3 py-1.5 border rounded text-sm"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Plateforme</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full mt-1 px-3 py-1.5 border rounded text-sm"
              >
                <option value="ecowitt">Ecowitt</option>
                <option value="wunderground">Weather Underground</option>
                <option value="netatmo">Netatmo</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">
              {provider === "ecowitt" ? "Adresse MAC de la station" : "ID de la station"}
            </label>
            <input
              type="text"
              value={stationId}
              onChange={(e) => setStationId(e.target.value)}
              placeholder={provider === "ecowitt" ? "AA:BB:CC:DD:EE:FF" : "KFRYOUR001"}
              className="w-full mt-1 px-3 py-1.5 border rounded text-sm"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full mt-1 px-3 py-1.5 border rounded text-sm"
                required={provider !== "netatmo"}
              />
            </div>
            {provider === "ecowitt" && (
              <div>
                <label className="text-xs font-medium text-slate-600">Application Key</label>
                <input
                  type="password"
                  value={appKey}
                  onChange={(e) => setAppKey(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 border rounded text-sm"
                  required
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600">Latitude (optionnel)</label>
              <input
                type="number"
                step="any"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="48.8566"
                className="w-full mt-1 px-3 py-1.5 border rounded text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Longitude (optionnel)</label>
              <input
                type="number"
                step="any"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="2.3522"
                className="w-full mt-1 px-3 py-1.5 border rounded text-sm"
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              Annuler
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Enregistrer
            </Button>
          </div>
        </form>
      )}

      {/* Info providers */}
      <div className="text-[10px] text-slate-400 leading-relaxed">
        <p><strong>Ecowitt</strong> : Cles API sur ecowitt.net/home/index → API → Get API/App Key</p>
        <p><strong>Weather Underground</strong> : Cle API sur wunderground.com → My Profile → API Keys</p>
        <p><strong>Netatmo</strong> : Support a venir (OAuth2)</p>
      </div>
    </div>
  )
}
