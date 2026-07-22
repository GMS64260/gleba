"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { X, Save, Trash2, Camera, Loader2, ExternalLink, MoveRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ParcelleGeoData {
  id: string
  nom: string
  geometry: string
  surface?: number | null
  commune?: string | null
  section?: string | null
  numero?: string | null
  usage?: string | null
  couleur?: string | null
  notes?: string | null
  typeSol?: string | null
  betail?: {
    totalTetes: number
    animauxIndividuels: number
    animaux: Array<{ id: number; nom: string | null; identifiant: string | null; espece: string }>
    lots: Array<{ id: number; nom: string | null; espece: string; quantiteActuelle: number }>
    parEspece: Array<{ espece: string; count: number }>
  } | null
}

interface ParcellePanelProps {
  parcelle: ParcelleGeoData | null
  isCreating: boolean
  newGeometry: string | null
  onSave: (data: Partial<ParcelleGeoData>) => void
  onDelete: (id: string) => void
  onClose: () => void
  parcelles: Array<{ id: string; nom: string }>
  onMovementComplete: (destinationId: string) => void | Promise<void>
}

// Options pour le champ usage
const USAGE_OPTIONS = [
  { value: 'culture', label: 'Culture' },
  { value: 'prairie', label: 'Prairie' },
  { value: 'verger', label: 'Verger' },
  { value: 'friche', label: 'Friche' },
  { value: 'jardin', label: 'Jardin' },
  { value: 'autre', label: 'Autre' },
]

// Options pour le type de sol
const TYPE_SOL_OPTIONS = [
  { value: 'argileux', label: 'Argileux' },
  { value: 'limoneux', label: 'Limoneux' },
  { value: 'sableux', label: 'Sableux' },
  { value: 'calcaire', label: 'Calcaire' },
  { value: 'mixte', label: 'Mixte' },
]

/**
 * Panneau lateral droit pour afficher et editer les proprietes d'une parcelle.
 * Gere deux modes : edition (parcelle existante) et creation (nouvelle geometrie).
 */
export default function ParcellePanel({
  parcelle,
  isCreating,
  newGeometry,
  onSave,
  onDelete,
  onClose,
  parcelles,
  onMovementComplete,
}: ParcellePanelProps) {
  const [nom, setNom] = useState('')
  const [usages, setUsages] = useState<string[]>([])
  const [typeSol, setTypeSol] = useState<string | undefined>(undefined)
  const [couleur, setCouleur] = useState('#16a34a')
  const [notes, setNotes] = useState('')
  const [movingSubject, setMovingSubject] = useState<{ type: 'lot' | 'animal'; id: number } | null>(null)
  const [destinationId, setDestinationId] = useState('')
  const [isMoving, setIsMoving] = useState(false)
  const [movementError, setMovementError] = useState('')

  // Reinitialiser les champs quand la parcelle change
  useEffect(() => {
    if (parcelle) {
      setNom(parcelle.nom)
      setUsages(parcelle.usage ? parcelle.usage.split(',').map(u => u.trim()) : [])
      setTypeSol(parcelle.typeSol ?? undefined)
      setCouleur(parcelle.couleur ?? '#16a34a')
      setNotes(parcelle.notes ?? '')
    } else if (isCreating) {
      setNom('')
      setUsages([])
      setTypeSol(undefined)
      setCouleur('#16a34a')
      setNotes('')
    }
  }, [parcelle, isCreating])

  // Determiner si le panneau est visible
  const isVisible = parcelle !== null || (isCreating && newGeometry !== null)
  if (!isVisible) return null

  const isEditMode = parcelle !== null
  const titre = isEditMode ? 'Modifier la parcelle' : 'Nouvelle parcelle'

  // Formater la surface en hectares
  const formatSurface = (surface: number | null | undefined): string => {
    if (surface == null) return '--'
    return `${surface.toFixed(2)} ha`
  }

  const handleSave = () => {
    if (!nom.trim()) return

    const data: Partial<ParcelleGeoData> = {
      nom: nom.trim(),
      usage: usages.length > 0 ? usages.join(', ') : null,
      typeSol: typeSol ?? null,
      couleur,
      notes: notes.trim() || null,
    }

    // En mode creation, inclure la geometrie
    if (isCreating && newGeometry) {
      data.geometry = newGeometry
    }

    // En mode edition, inclure l'id
    if (isEditMode && parcelle) {
      data.id = parcelle.id
    }

    onSave(data)
  }

  const handleDelete = () => {
    if (parcelle) {
      onDelete(parcelle.id)
    }
  }

  const handleMoveLot = async () => {
    if (!parcelle || !movingSubject || !destinationId) return
    setIsMoving(true)
    setMovementError('')
    try {
      const response = await fetch('/api/elevage/mouvements-cheptel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [movingSubject.type === 'lot' ? 'lotId' : 'animalId']: movingSubject.id,
          parcelleAvantId: parcelle.id,
          parcelleApresId: destinationId,
          date: new Date().toISOString(),
          motif: 'Changement de parcelle depuis la cartographie',
        }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error || 'Impossible de déplacer ce lot')
      }
      setMovingSubject(null)
      setDestinationId('')
      await onMovementComplete(destinationId)
    } catch (error) {
      setMovementError(error instanceof Error ? error.message : 'Impossible de déplacer ce lot')
    } finally {
      setIsMoving(false)
    }
  }

  return (
    <div className="w-full md:w-80 bg-white shadow-lg h-full overflow-y-auto border-l flex flex-col">
      {/* En-tete */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold text-slate-900">{titre}</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Contenu du formulaire */}
      <div className="flex-1 p-4 space-y-4">
        {/* Nom (obligatoire) */}
        <div className="space-y-2">
          <Label htmlFor="parcelle-nom">Nom *</Label>
          <Input
            id="parcelle-nom"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Nom de la parcelle"
            required
          />
        </div>

        {/* Usage (multi-selection) */}
        <div className="space-y-2">
          <Label>Usage</Label>
          <div className="flex flex-wrap gap-2">
            {USAGE_OPTIONS.map((opt) => {
              const checked = usages.includes(opt.value)
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setUsages(prev =>
                    prev.includes(opt.value)
                      ? prev.filter(u => u !== opt.value)
                      : [...prev, opt.value]
                  )}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                    checked
                      ? 'bg-emerald-100 border-emerald-400 text-emerald-800 font-medium'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
                  }`}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Type de sol */}
        <div className="space-y-2">
          <Label htmlFor="parcelle-sol">Type de sol</Label>
          <Select value={typeSol} onValueChange={setTypeSol}>
            <SelectTrigger id="parcelle-sol">
              <SelectValue placeholder="Sélectionner un type de sol" />
            </SelectTrigger>
            <SelectContent>
              {TYPE_SOL_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Couleur */}
        <div className="space-y-2">
          <Label htmlFor="parcelle-couleur">Couleur</Label>
          <div className="flex items-center gap-2">
            <input
              id="parcelle-couleur"
              type="color"
              value={couleur}
              onChange={(e) => setCouleur(e.target.value)}
              className="h-9 w-12 rounded border border-input cursor-pointer"
            />
            <span className="text-sm text-muted-foreground">{couleur}</span>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="parcelle-notes">Notes</Label>
          <Textarea
            id="parcelle-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes libres..."
            rows={3}
          />
        </div>

        {/* Informations en lecture seule (mode edition uniquement) */}
        {isEditMode && parcelle && (
          <div className="space-y-3 pt-2 border-t">
            <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wide">
              Informations
            </h3>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Surface</span>
                <span className="font-medium">{formatSurface(parcelle.surface)}</span>
              </div>

              {parcelle.commune && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Commune</span>
                  <span className="font-medium">{parcelle.commune}</span>
                </div>
              )}

              {parcelle.section && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Section</span>
                  <span className="font-medium">{parcelle.section}</span>
                </div>
              )}

              {parcelle.numero && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Numero</span>
                  <span className="font-medium">{parcelle.numero}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bétail présent (cartographie élevage 2026-07-21) */}
        {isEditMode && parcelle?.betail && parcelle.betail.totalTetes > 0 && (
          <div className="space-y-3 pt-2 border-t">
            <h3 className="text-sm font-medium text-amber-700 uppercase tracking-wide">
              Bétail présent · {parcelle.betail.totalTetes} têtes
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {parcelle.betail.parEspece.map((e) => (
                <span
                  key={e.espece}
                  className="rounded-full bg-amber-100 text-amber-800 px-2.5 py-1 text-xs font-medium"
                >
                  {e.count} {e.espece}
                </span>
              ))}
            </div>
            {parcelle.betail.lots.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Lots</p>
                {parcelle.betail.lots.map((l) => (
                  <div key={l.id} className="rounded-md border p-2 space-y-2">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <Link href={`/elevage/lots/${l.id}`} className="min-w-0 truncate hover:underline">
                        {l.nom || `Lot #${l.id}`}
                      </Link>
                      <span className="shrink-0 text-muted-foreground">{l.quantiteActuelle} · {l.espece}</span>
                    </div>
                    {movingSubject?.type === 'lot' && movingSubject.id === l.id ? (
                      <div className="space-y-2">
                        <Label htmlFor={`destination-${l.id}`} className="text-xs">Parcelle de destination</Label>
                        <Select value={destinationId} onValueChange={setDestinationId}>
                          <SelectTrigger id={`destination-${l.id}`} className="min-h-11">
                            <SelectValue placeholder="Choisir une parcelle" />
                          </SelectTrigger>
                          <SelectContent>
                            {parcelles.filter((p) => p.id !== parcelle.id).map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Confirmer déplacera tout le lot vers la parcelle choisie.
                        </p>
                        {movementError && <p role="alert" className="text-xs text-red-600">{movementError}</p>}
                        <div className="grid grid-cols-2 gap-2">
                          <Button type="button" variant="outline" className="min-h-11" onClick={() => { setMovingSubject(null); setDestinationId(''); setMovementError('') }}>
                            Annuler
                          </Button>
                          <Button type="button" className="min-h-11 bg-amber-600 hover:bg-amber-700" disabled={!destinationId || isMoving} onClick={handleMoveLot}>
                            {isMoving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmer'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button type="button" variant="outline" className="w-full min-h-11 border-amber-300 text-amber-800" onClick={() => { setMovingSubject({ type: 'lot', id: l.id }); setMovementError('') }} disabled={parcelles.length < 2}>
                        <MoveRight className="h-4 w-4 mr-2" />
                        Déplacer vers une autre parcelle
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {parcelle.betail.animauxIndividuels > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Animaux individuels</p>
                {parcelle.betail.animaux.map((animal) => (
                  <div key={animal.id} className="rounded-md border p-2 space-y-2">
                    <p className="text-sm font-medium">{animal.nom || animal.identifiant || `Animal #${animal.id}`} <span className="font-normal text-muted-foreground">· {animal.espece}</span></p>
                    {movingSubject?.type === 'animal' && movingSubject.id === animal.id ? (
                      <div className="space-y-2">
                        <Label htmlFor={`destination-animal-${animal.id}`} className="text-xs">Parcelle de destination</Label>
                        <Select value={destinationId} onValueChange={setDestinationId}>
                          <SelectTrigger id={`destination-animal-${animal.id}`} className="min-h-11"><SelectValue placeholder="Choisir une parcelle" /></SelectTrigger>
                          <SelectContent>
                            {parcelles.filter((p) => p.id !== parcelle.id).map((p) => <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">Confirmer déplacera cet animal vers la parcelle choisie.</p>
                        {movementError && <p role="alert" className="text-xs text-red-600">{movementError}</p>}
                        <div className="grid grid-cols-2 gap-2">
                          <Button type="button" variant="outline" className="min-h-11" onClick={() => { setMovingSubject(null); setDestinationId(''); setMovementError('') }}>Annuler</Button>
                          <Button type="button" className="min-h-11 bg-amber-600 hover:bg-amber-700" disabled={!destinationId || isMoving} onClick={handleMoveLot}>{isMoving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmer'}</Button>
                        </div>
                      </div>
                    ) : (
                      <Button type="button" variant="outline" className="w-full min-h-11 border-amber-300 text-amber-800" onClick={() => { setMovingSubject({ type: 'animal', id: animal.id }); setMovementError('') }} disabled={parcelles.length < 2}>
                        <MoveRight className="h-4 w-4 mr-2" />Déplacer vers une autre parcelle
                      </Button>
                    )}
                  </div>
                ))}
                <Link href="/elevage?tab=animaux" className="block text-sm text-amber-700 hover:underline">Voir tous les animaux →</Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Boutons d'action */}
      <div className="p-4 border-t space-y-2">
        <Button
          onClick={handleSave}
          disabled={!nom.trim()}
          className="w-full bg-green-600 hover:bg-green-700 text-white"
        >
          <Save className="h-4 w-4 mr-2" />
          Enregistrer
        </Button>

        {isEditMode && (
          <Button
            variant="destructive"
            onClick={handleDelete}
            className="w-full"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Supprimer
          </Button>
        )}
      </div>

      {/* Export satellite vers plan 2D */}
      {isEditMode && parcelle && <SatelliteExport geometry={parcelle.geometry} parcelleId={parcelle.id} />}
    </div>
  )
}

/**
 * Calcule le bounding box d'un polygone GeoJSON
 */
function getBoundingBox(geojsonStr: string) {
  try {
    const geo = JSON.parse(geojsonStr)
    const coords: [number, number][] =
      geo.type === 'MultiPolygon'
        ? geo.coordinates.flat(2)
        : geo.coordinates[0]
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity
    for (const [lng, lat] of coords) {
      if (lng < minLng) minLng = lng
      if (lat < minLat) minLat = lat
      if (lng > maxLng) maxLng = lng
      if (lat > maxLat) maxLat = lat
    }
    // Marge de 5% pour ne pas coller aux bords
    const dLng = (maxLng - minLng) * 0.05
    const dLat = (maxLat - minLat) * 0.05
    return {
      lng1: minLng - dLng,
      lat1: minLat - dLat,
      lng2: maxLng + dLng,
      lat2: maxLat + dLat,
    }
  } catch {
    return null
  }
}

/**
 * Projette le polygone de la parcelle dans les PIXELS de l'image capturée
 * (même bbox, même dimensions) : le contour reste collé à la photo sur le
 * plan 2D, même après recalibration ou rotation du fond.
 */
function contourEnPixels(
  geojsonStr: string,
  bbox: { lng1: number; lat1: number; lng2: number; lat2: number },
  width: number,
  height: number
): number[][][] | null {
  try {
    const geo = JSON.parse(geojsonStr)
    const rings: [number, number][][] =
      geo.type === 'MultiPolygon'
        ? geo.coordinates.map((poly: [number, number][][]) => poly[0])
        : geo.type === 'Polygon'
          ? [geo.coordinates[0]]
          : []
    if (rings.length === 0) return null
    const dLng = bbox.lng2 - bbox.lng1
    const dLat = bbox.lat2 - bbox.lat1
    if (dLng <= 0 || dLat <= 0) return null
    // Le haut de l'image WMS = lat2 (nord) → py croît vers le sud
    return rings.map(ring =>
      ring.map(([lng, lat]) => [
        Math.round(((lng - bbox.lng1) / dLng) * width * 100) / 100,
        Math.round(((bbox.lat2 - lat) / dLat) * height * 100) / 100,
      ])
    )
  } catch {
    return null
  }
}

/**
 * Bloc d'export de l'image satellite vers le plan 2D
 */
function SatelliteExport({ geometry, parcelleId }: { geometry: string; parcelleId: string }) {
  const [capturing, setCapturing] = useState(false)
  const [captured, setCaptured] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const handleCapture = async () => {
    const bbox = getBoundingBox(geometry)
    if (!bbox) {
      setErreur('Géométrie de parcelle illisible')
      return
    }

    setCapturing(true)
    setCaptured(false)
    setErreur(null)

    try {
      const res = await fetch(
        `/api/carte/satellite?bbox=${bbox.lng1},${bbox.lat1},${bbox.lng2},${bbox.lat2}&width=1280&height=1024`
      )
      if (!res.ok) throw new Error("Impossible de récupérer l'image satellite IGN")

      const data = await res.json()

      // Persistance serveur (FondPlan) : le fond suit le compte sur tous les
      // appareils, et l'échelle m/px issue du bbox géographique arrive déjà
      // calibrée — aucun réglage manuel nécessaire sur le plan 2D.
      const blob = await (await fetch(data.image)).blob()
      const formData = new FormData()
      formData.append('parcelle', parcelleId)
      formData.append('file', blob, 'satellite-ign.jpg')
      formData.append('opacity', '0.8')
      formData.append('scale', String((data.dimensions.scaleX + data.dimensions.scaleY) / 2))
      formData.append('offsetX', '0')
      formData.append('offsetY', '0')
      formData.append('rotation', '0')

      // Contour de la parcelle dessiné sur la carte → visible sur le plan 2D
      const contour = contourEnPixels(geometry, bbox, data.width, data.height)
      if (contour) formData.append('contour', JSON.stringify(contour))

      const up = await fetch('/api/jardin/fond', { method: 'POST', body: formData })
      if (!up.ok) {
        const err = await up.json().catch(() => null)
        throw new Error(err?.error || "Enregistrement du fond impossible")
      }

      setCaptured(true)
    } catch (err) {
      console.error('Capture satellite:', err)
      setErreur(err instanceof Error ? err.message : 'Capture impossible')
    } finally {
      setCapturing(false)
    }
  }

  return (
    <div className="p-4 border-t space-y-3">
      <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wide">
        Plan 2D
      </h3>
      <p className="text-xs text-muted-foreground">
        Utiliser la photo satellite de cette parcelle comme fond du plan 2D. L&apos;échelle
        est calée automatiquement et le fond est enregistré sur votre compte.
      </p>

      {erreur && <p className="text-xs font-medium text-red-600">{erreur}</p>}

      {!captured ? (
        <Button
          variant="outline"
          onClick={handleCapture}
          disabled={capturing}
          className="w-full"
        >
          {capturing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Capture en cours...
            </>
          ) : (
            <>
              <Camera className="h-4 w-4 mr-2" />
              Capturer le fond satellite
            </>
          )}
        </Button>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-green-700 font-medium">
            Fond satellite applique au plan 2D.
          </p>
          <Link href={`/jardin?parcelle=${parcelleId}`}>
            <Button variant="outline" className="w-full">
              <ExternalLink className="h-4 w-4 mr-2" />
              Ouvrir le plan 2D
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}
