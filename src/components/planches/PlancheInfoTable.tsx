"use client"

/**
 * Tableau d'informations planche avec édition inline
 * Click sur cellule → modifiable directement
 */

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { InlineEditField } from "./InlineEditField"
import { Droplets, Ruler, MapPin } from "lucide-react"

interface Planche {
  id: string
  ilot: string | null
  surface: number | null
  largeur: number | null
  longueur: number | null
  type: string | null
  irrigation: string | null
  typeSol: string | null
  retentionEau: string | null
  notes: string | null
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

  const handleUpdate = async (field: string, value: string | number | null) => {
    try {
      const res = await fetch(`/api/planches/${encodeURIComponent(planche.id)}`, {
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
      alert('Erreur lors de la sauvegarde')
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
                    type="text"
                    placeholder="Non défini"
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
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Qualité du sol */}
      <Card className="border-blue-200 bg-blue-50/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Droplets className="h-4 w-4 text-blue-600" />
            Qualité du sol
            <Badge variant="outline" className="ml-2 text-xs">Influence irrigation</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
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
