'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MapPin, ArrowLeft, AlertTriangle } from 'lucide-react'

interface ParcellePlanche {
  id: string
  nom: string | null
  surface: number | null
  type: string | null
  irrigation: string | null
}

interface Parcelle {
  id: string
  nom: string
  surface: number | null
  couches: string[]
  notes: string | null
  commune: string | null
  section: string | null
  numero: string | null
  typeSol: string | null
  usage: string | null
  planches: ParcellePlanche[]
}

const COUCHE_COLORS: Record<string, string> = {
  MARAICHAGE: 'bg-emerald-100 text-emerald-800',
  VERGER: 'bg-lime-100 text-lime-800',
  ELEVAGE: 'bg-amber-100 text-amber-800',
  PATURAGE: 'bg-green-100 text-green-800',
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default function ParcelleDetailPage({ params }: PageProps) {
  const { id } = use(params)
  const [parcelle, setParcelle] = useState<Parcelle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/parcelles/${encodeURIComponent(id)}`)
      .then(r => {
        if (!r.ok) throw new Error(r.status === 404 ? 'Parcelle non trouvée' : 'Erreur de chargement')
        return r.json()
      })
      .then(setParcelle)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center text-slate-500">Chargement...</div>
      </div>
    )
  }

  // Coherence surface parcelle (en ha) vs somme surfaces planches (en m2)
  const planchesSurfaceM2 = parcelle?.planches
    ? parcelle.planches.reduce((sum, p) => sum + (p.surface || 0), 0)
    : 0
  const parcelleSurfaceM2 = parcelle?.surface != null ? parcelle.surface * 10000 : 0
  const ratio =
    parcelleSurfaceM2 > 0 && planchesSurfaceM2 > 0
      ? planchesSurfaceM2 / parcelleSurfaceM2
      : null
  // Warning si planches couvrent < 1% de la parcelle declaree
  const showCoherenceWarning =
    ratio !== null && ratio < 0.01 && parcelle?.planches && parcelle.planches.length > 0

  if (error || !parcelle) {
    return (
      <div className="container mx-auto p-6 text-center">
        <p className="text-red-500">{error || 'Parcelle non trouvée'}</p>
        <Link href="/parcelles" className="mt-4 text-blue-600 hover:underline">
          Retour aux parcelles
        </Link>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      {/* Breadcrumb + Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm">
          <Link href="/parcelles" className="text-slate-500 hover:text-slate-700">
            Parcelles
          </Link>
          <span className="text-slate-400">/</span>
          <span className="font-medium text-slate-900">{parcelle.nom}</span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">{parcelle.nom}</h1>
          <Link
            href="/parcelles"
            className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Link>
        </div>
      </div>

      {/* Warning incoherence surface parcelle vs planches */}
      {showCoherenceWarning && (
        <div className="mb-4 p-3 rounded-lg border border-amber-300 bg-amber-50 flex items-start gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-amber-800">
            <strong>Incohérence détectée.</strong> Vos planches couvrent seulement{" "}
            <strong>{Math.round(planchesSurfaceM2)} m²</strong> sur{" "}
            <strong>{parcelle.surface?.toFixed(2)} ha</strong> déclarés (
            {((ratio ?? 0) * 100).toFixed(2)}%). Vérifiez la surface de la parcelle ou ajoutez les
            planches manquantes.
          </p>
        </div>
      )}

      {/* Infos parcelle */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Informations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <tbody className="divide-y">
              <tr>
                <td className="py-2 text-muted-foreground w-1/3">Surface</td>
                <td className="py-2 font-medium">
                  {parcelle.surface != null ? `${parcelle.surface.toFixed(2)} ha` : '-'}
                </td>
              </tr>
              {parcelle.couches.length > 0 && (
                <tr>
                  <td className="py-2 text-muted-foreground">Couches</td>
                  <td className="py-2">
                    <div className="flex gap-1 flex-wrap">
                      {parcelle.couches.map(c => (
                        <Badge key={c} className={COUCHE_COLORS[c] || 'bg-slate-100 text-slate-800'}>
                          {c.charAt(0) + c.slice(1).toLowerCase()}
                        </Badge>
                      ))}
                    </div>
                  </td>
                </tr>
              )}
              {parcelle.commune && (
                <tr>
                  <td className="py-2 text-muted-foreground">Commune</td>
                  <td className="py-2 font-medium">{parcelle.commune}</td>
                </tr>
              )}
              {parcelle.typeSol && (
                <tr>
                  <td className="py-2 text-muted-foreground">Type de sol</td>
                  <td className="py-2 font-medium">{parcelle.typeSol}</td>
                </tr>
              )}
              {parcelle.usage && (
                <tr>
                  <td className="py-2 text-muted-foreground">Usage</td>
                  <td className="py-2 font-medium">{parcelle.usage}</td>
                </tr>
              )}
            </tbody>
          </table>
          {parcelle.notes && (
            <p className="mt-3 text-sm text-muted-foreground whitespace-pre-wrap">{parcelle.notes}</p>
          )}
        </CardContent>
      </Card>

      {/* Planches rattachées */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Planches rattachées ({parcelle.planches.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {parcelle.planches.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune planche rattachée à cette parcelle</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 font-medium">Nom</th>
                  <th className="py-2 font-medium">Surface</th>
                  <th className="py-2 font-medium">Type</th>
                  <th className="py-2 font-medium">Irrigation</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {parcelle.planches.map(p => (
                  <tr key={p.id}>
                    <td className="py-2">
                      <Link
                        href={`/maraichage/planches/${encodeURIComponent(p.nom || p.id)}`}
                        className="text-green-600 hover:underline font-medium"
                      >
                        {p.nom || p.id}
                      </Link>
                    </td>
                    <td className="py-2">{p.surface != null ? `${p.surface} m²` : '-'}</td>
                    <td className="py-2">{p.type || '-'}</td>
                    <td className="py-2">{p.irrigation || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
