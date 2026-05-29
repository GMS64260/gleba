"use client"

/**
 * Tableau d'informations planche avec édition inline
 * Click sur cellule → modifiable directement
 */

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { InlineEditField } from "./InlineEditField"
import { Droplets, Ruler, MapPin, Loader2, Satellite } from "lucide-react"
import { alertDialog } from "@/lib/global-dialog"

interface Planche {
  id: string
  nom?: string | null
  ilot: string | null
  surface: number | null
  largeur: number | null
  longueur: number | null
  type: string | null
  irrigation: string | null
  typeSol: string | null
  retentionEau: string | null
  notes: string | null
  argile?: number | null
  limon?: number | null
  sable?: number | null
  phSol?: number | null
  carboneOrg?: number | null
  parcelleGeoId?: string | null
  parcelleGeo?: {
    id?: string
    nom?: string
    surface?: number | null
    centroidLat?: number | null
    centroidLng?: number | null
  } | null
}

interface PlancheInfoTableProps {
  planche: Planche
  onUpdate: () => void
}

const TYPES_SOL = ['Argileux', 'Limoneux', 'Sableux', 'Mixte']
const RETENTION_EAU = ['Faible', 'Moyenne', 'Élevée']
const PLANCHE_TYPES = ['Serre', 'Plein champ', 'Tunnel', 'Chassis']
const PLANCHE_IRRIGATION = ['Goutte-a-goutte', 'Aspersion', 'Manuel', 'Aucun']

export function PlancheInfoTable({ planche, onUpdate }: PlancheInfoTableProps) {
  const [ilotOptions, setIlotOptions] = React.useState<{value: string, label: string}[]>([])
  const [parcelles, setParcelles] = React.useState<{id: string, nom: string}[]>([])
  const [soilLoading, setSoilLoading] = React.useState(false)
  const [soilEstimate, setSoilEstimate] = React.useState<{
    argile: number; limon: number; sable: number; ph: number; carboneOrg: number
    typeSol: string; retentionEau: string
  } | null>(null)

  React.useEffect(() => {
    fetch("/api/planches?pageSize=500").then(r => r.json()).then(data => {
      const planches = data.data || data || []
      const unique = [...new Set(planches.map((p: any) => p.ilot).filter(Boolean))] as string[]
      setIlotOptions(unique.sort().map(v => ({ value: v, label: v })))
    }).catch(() => {})

    fetch("/api/carte").then(r => r.json()).then(data => {
      const list = Array.isArray(data) ? data : []
      setParcelles(list.map((p: any) => ({ id: p.id, nom: p.nom })))
    }).catch(() => {})
  }, [])

  const hasGPS = !!(planche.parcelleGeo?.centroidLat && planche.parcelleGeo?.centroidLng)

  const fetchSoilEstimate = async () => {
    if (!hasGPS) return
    setSoilLoading(true)
    setSoilEstimate(null)
    try {
      const lat = planche.parcelleGeo!.centroidLat
      const lng = planche.parcelleGeo!.centroidLng
      const res = await fetch(`/api/sol/soilgrids?lat=${lat}&lng=${lng}`)
      if (!res.ok) throw new Error("Données indisponibles")
      const json = await res.json()
      setSoilEstimate({
        argile: json.donnees.argile,
        limon: json.donnees.limon,
        sable: json.donnees.sable,
        ph: json.donnees.ph,
        carboneOrg: json.donnees.carboneOrg,
        typeSol: json.calculs.typeSol,
        retentionEau: json.calculs.retentionEau,
      })
    } catch (e) {
      await alertDialog("Impossible de récupérer les données sol pour ces coordonnées.")
    } finally {
      setSoilLoading(false)
    }
  }

  const applySoilEstimate = async () => {
    if (!soilEstimate) return
    try {
      const res = await fetch(`/api/planches/${encodeURIComponent(planche.nom || planche.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          typeSol: soilEstimate.typeSol,
          retentionEau: soilEstimate.retentionEau,
          argile: soilEstimate.argile,
          limon: soilEstimate.limon,
          sable: soilEstimate.sable,
          phSol: soilEstimate.ph,
          carboneOrg: soilEstimate.carboneOrg,
        }),
      })
      if (!res.ok) throw new Error("Erreur")
      setSoilEstimate(null)
      onUpdate()
    } catch {
      await alertDialog("Erreur lors de la sauvegarde")
    }
  }

  const handleUpdate = async (field: string, value: string | number | null) => {
    try {
      const res = await fetch(`/api/planches/${encodeURIComponent(planche.nom || planche.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })

      if (!res.ok) {
        throw new Error('Erreur sauvegarde')
      }

      onUpdate()
    } catch (error) {
      console.error('Erreur:', error)
      await alertDialog('Erreur lors de la sauvegarde')
    }
  }

  return (
    <div className="space-y-4">
      {/* Dimensions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Ruler className="h-4 w-4" />
            Dimensions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <tbody className="divide-y">
              <tr>
                <td className="py-2 text-muted-foreground w-1/3">Largeur</td>
                <td className="py-2 font-medium">
                  <InlineEditField
                    value={planche.largeur}
                    onSave={(v) => handleUpdate('largeur', v ? parseFloat(v) : null)}
                    type="number"
                    unit=" m"
                    placeholder="-"
                  />
                </td>
              </tr>
              <tr>
                <td className="py-2 text-muted-foreground">Longueur</td>
                <td className="py-2 font-medium">
                  <InlineEditField
                    value={planche.longueur}
                    onSave={(v) => handleUpdate('longueur', v ? parseFloat(v) : null)}
                    type="number"
                    unit=" m"
                    placeholder="-"
                  />
                </td>
              </tr>
              <tr>
                <td className="py-2 text-muted-foreground">Surface</td>
                <td className="py-2">
                  {planche.surface ? (
                    <Badge variant="secondary">{planche.surface.toFixed(1)} m²</Badge>
                  ) : (
                    <span className="text-muted-foreground">Auto-calculée</span>
                  )}
                </td>
              </tr>
              <tr>
                <td className="py-2 text-muted-foreground">Îlot</td>
                <td className="py-2 font-medium">
                  <InlineEditField
                    value={planche.ilot}
                    onSave={(v) => handleUpdate('ilot', v)}
                    type="combobox"
                    comboboxOptions={ilotOptions}
                    placeholder="Ex: Nord, Serre, Jardin..."
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Infrastructure */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Infrastructure
          </CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <tbody className="divide-y">
              <tr>
                <td className="py-2 text-muted-foreground w-1/3">Type</td>
                <td className="py-2 font-medium">
                  <InlineEditField
                    value={planche.type}
                    onSave={(v) => handleUpdate('type', v)}
                    type="select"
                    options={PLANCHE_TYPES}
                    placeholder="Non défini"
                  />
                </td>
              </tr>
              <tr>
                <td className="py-2 text-muted-foreground">Irrigation</td>
                <td className="py-2 font-medium">
                  <InlineEditField
                    value={planche.irrigation}
                    onSave={(v) => handleUpdate('irrigation', v)}
                    type="select"
                    options={PLANCHE_IRRIGATION}
                    placeholder="Non défini"
                  />
                </td>
              </tr>
              <tr>
                <td className="py-2 text-muted-foreground">Parcelle</td>
                <td className="py-2 font-medium">
                  <select
                    value={planche.parcelleGeoId || ""}
                    onChange={async (e) => {
                      await handleUpdate('parcelleGeoId', e.target.value || null)
                    }}
                    className="bg-transparent border-0 p-0 text-sm font-medium cursor-pointer hover:text-green-600"
                  >
                    <option value="">Aucune</option>
                    {parcelles.map(p => (
                      <option key={p.id} value={p.id}>{p.nom}</option>
                    ))}
                  </select>
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Qualité du sol */}
      <Card className="border-blue-200 bg-blue-50/30">
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <CardTitle className="text-base flex items-center gap-2">
              <Droplets className="h-4 w-4 text-blue-600" />
              Qualité du sol
              <Badge variant="outline" className="ml-2 text-xs">Influence irrigation</Badge>
            </CardTitle>
            {hasGPS && (
              <button
                onClick={fetchSoilEstimate}
                disabled={soilLoading}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                title="Estimer les propriétés du sol depuis les données satellite SoilGrids (résolution 250m)"
              >
                {soilLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Satellite className="h-3 w-3" />
                )}
                <span>Estimer depuis GPS</span>
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Panneau estimation SoilGrids */}
          {soilEstimate && (
            <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Satellite className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Estimation SoilGrids (250m)</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-2">
                <span className="text-slate-600">Argile : <strong>{soilEstimate.argile}%</strong></span>
                <span className="text-slate-600">pH : <strong>{soilEstimate.ph}</strong></span>
                <span className="text-slate-600">Limon : <strong>{soilEstimate.limon}%</strong></span>
                <span className="text-slate-600">C. organique : <strong>{soilEstimate.carboneOrg}%</strong></span>
                <span className="text-slate-600">Sable : <strong>{soilEstimate.sable}%</strong></span>
                <span className="text-slate-600">Type : <strong>{soilEstimate.typeSol}</strong></span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={applySoilEstimate}
                  className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors"
                >
                  Appliquer
                </button>
                <button
                  onClick={() => setSoilEstimate(null)}
                  className="text-xs text-slate-500 px-3 py-1 rounded hover:bg-slate-100 transition-colors"
                >
                  Ignorer
                </button>
              </div>
            </div>
          )}

          <table className="w-full text-sm">
            <tbody className="divide-y">
              <tr>
                <td className="py-2 text-muted-foreground w-1/3">Type de sol</td>
                <td className="py-2 font-medium">
                  <InlineEditField
                    value={planche.typeSol}
                    onSave={(v) => handleUpdate('typeSol', v)}
                    type="select"
                    options={TYPES_SOL}
                    placeholder="Non renseigné"
                  />
                </td>
              </tr>
              <tr>
                <td className="py-2 text-muted-foreground">Rétention eau</td>
                <td className="py-2 font-medium">
                  <InlineEditField
                    value={planche.retentionEau}
                    onSave={(v) => handleUpdate('retentionEau', v)}
                    type="select"
                    options={RETENTION_EAU}
                    placeholder="Non renseigné"
                  />
                </td>
              </tr>
            </tbody>
          </table>

          {planche.retentionEau && (
            <div className="mt-3 p-2 bg-blue-100 rounded text-xs text-blue-800">
              {planche.retentionEau === 'Faible' && '💧 Sol léger → Arrosage fréquent (+50% fréquence, +20% quantité)'}
              {planche.retentionEau === 'Moyenne' && '💦 Sol équilibré → Arrosage normal'}
              {planche.retentionEau === 'Élevée' && '💙 Sol lourd → Arrosage espacé (-30% fréquence, -20% quantité)'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      {planche.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{planche.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
