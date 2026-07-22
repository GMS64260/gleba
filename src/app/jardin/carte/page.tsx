"use client"

/**
 * Page Cartographie - Vue georeferencee des parcelles
 * Integre Leaflet avec fonds OSM/IGN, dessin de polygones,
 * import cadastral et gestion CRUD des parcelles.
 */

import { useState, useEffect, useCallback, Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import dynamic from "next/dynamic"
import { ArrowLeft, Loader2, Map as MapIcon, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import type L from "leaflet"

import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import type { ParcelleGeoData } from "@/components/carte/ParcelleLayer"
import type { CadastreResult } from "@/components/carte/CadastreSearch"

// Composants non-Leaflet : import statique
import ParcelleList from "@/components/carte/ParcelleList"
import ParcellePanel from "@/components/carte/ParcellePanel"
import MapToolbar from "@/components/carte/MapToolbar"

// Composants Leaflet : imports dynamiques (pas de SSR)
const MapContainer = dynamic(
  () => import("@/components/carte/MapContainer"),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center bg-muted">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    ),
  }
)

const GeolocateControl = dynamic(
  () => import("@/components/carte/GeolocateControl"),
  { ssr: false }
)

const ParcelleLayer = dynamic(
  () => import("@/components/carte/ParcelleLayer"),
  { ssr: false }
)

const DrawingTools = dynamic(
  () => import("@/components/carte/DrawingTools"),
  { ssr: false }
)

const EditingTools = dynamic(
  () => import("@/components/carte/EditingTools"),
  { ssr: false }
)

const CadastreSearch = dynamic(
  () => import("@/components/carte/CadastreSearch"),
  { ssr: false }
)

function CartePageContent() {
  // -- State --
  const searchParams = useSearchParams()
  const usageFilter = searchParams.get("usage")
  const parcelleIdParam = searchParams.get("parcelle")
  const [parcelles, setParcelles] = useState<ParcelleGeoData[]>([])
  const [selectedParcelle, setSelectedParcelle] = useState<ParcelleGeoData | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newGeometry, setNewGeometry] = useState<string | null>(null)
  const [showCadastre, setShowCadastre] = useState(false)
  const [showList, setShowList] = useState(true)
  const [mapRef, setMapRef] = useState<L.Map | null>(null)
  const [loading, setLoading] = useState(true)
  const [didAutoFocus, setDidAutoFocus] = useState(false)
  // Edition de parcelle
  const [isEditing, setIsEditing] = useState(false)
  const [editMode, setEditMode] = useState<"vertices" | "move">("vertices")
  const [editingParcelle, setEditingParcelle] = useState<ParcelleGeoData | null>(null)

  const { toast } = useToast()

  // -- Chargement des parcelles --
  const fetchParcelles = useCallback(async () => {
    try {
      const res = await fetch("/api/carte")
      if (!res.ok) throw new Error("Erreur serveur")
      const data: ParcelleGeoData[] = await res.json()
      setParcelles(data)
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de charger les parcelles.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchParcelles()
  }, [fetchParcelles])

  // -- Auto-focus sur parcelle par usage ou par ID --
  useEffect(() => {
    if (!mapRef || parcelles.length === 0 || didAutoFocus) return
    if (!usageFilter && !parcelleIdParam) return

    const target = parcelleIdParam
      ? parcelles.find(p => p.id === parcelleIdParam)
      : parcelles.find(p => p.usage === usageFilter)
    if (!target) return

    setDidAutoFocus(true)

    try {
      const geo = JSON.parse(target.geometry)
      const coords =
        geo.type === "MultiPolygon"
          ? geo.coordinates[0][0]
          : geo.coordinates[0]

      const latlngs = coords.map((c: [number, number]) => [c[1], c[0]] as [number, number])
      const bounds = (window as any).L.latLngBounds(latlngs)
      mapRef.flyToBounds(bounds, { padding: [50, 50], maxZoom: 18 })
      setSelectedParcelle(target)
    } catch {
      console.warn("Impossible de parser la geometrie pour auto-focus")
    }
  }, [usageFilter, parcelleIdParam, mapRef, parcelles, didAutoFocus])

  // -- Selection --
  const handleSelect = useCallback((parcelle: ParcelleGeoData) => {
    // Fermer le mode creation si actif
    setIsCreating(false)
    setNewGeometry(null)
    setSelectedParcelle(parcelle)
    if (window.matchMedia('(max-width: 767px)').matches) setShowList(false)
  }, [])

  // -- Dessin --
  const handleDrawStart = useCallback(() => {
    // Fermer le panel et le cadastre avant de dessiner
    setSelectedParcelle(null)
    setIsCreating(false)
    setNewGeometry(null)
    setShowCadastre(false)
    setIsDrawing(true)
  }, [])

  const handleDrawComplete = useCallback((geojson: string) => {
    setNewGeometry(geojson)
    setIsCreating(true)
    setIsDrawing(false)
  }, [])

  const handleDrawCancel = useCallback(() => {
    setIsDrawing(false)
  }, [])

  // -- Sauvegarde (creation et edition) --
  const handleSave = useCallback(async (data: Partial<ParcelleGeoData>) => {
    try {
      if (isCreating && newGeometry) {
        // Creation
        const body = { ...data, geometry: newGeometry }
        const res = await fetch("/api/carte", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => null)
          throw new Error(err?.error || "Erreur lors de la creation")
        }
        toast({ title: "Parcelle créée", description: `"${data.nom}" a été ajoutée.` })
      } else if (selectedParcelle) {
        // Edition
        const res = await fetch(`/api/carte/${selectedParcelle.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => null)
          throw new Error(err?.error || "Erreur lors de la mise a jour")
        }
        toast({ title: "Parcelle modifiée", description: `"${data.nom}" a été mise à jour.` })
      }

      // Recharger et fermer le panel
      await fetchParcelles()
      setSelectedParcelle(null)
      setIsCreating(false)
      setNewGeometry(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue"
      toast({ title: "Erreur", description: message, variant: "destructive" })
    }
  }, [isCreating, newGeometry, selectedParcelle, fetchParcelles, toast])

  // -- Suppression --
  const handleDelete = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/carte/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Erreur lors de la suppression")

      toast({ title: "Parcelle supprimée", description: "La parcelle a été supprimée." })

      await fetchParcelles()
      setSelectedParcelle(null)
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la parcelle.",
        variant: "destructive",
      })
    }
  }, [fetchParcelles, toast])

  // -- Import cadastral --
  const handleCadastreImport = useCallback(async (result: CadastreResult) => {
    try {
      const body = {
        nom: `${result.commune} - ${result.section} ${result.numero}`,
        geometry: result.geometry,
        commune: result.commune,
        section: result.section,
        numero: result.numero,
        surface: result.contenance ? result.contenance / 10000 : null,
        contenance: result.contenance,
      }

      const res = await fetch("/api/carte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || "Erreur lors de l'import")
      }

      toast({
        title: "Parcelle importee",
        description: `${result.commune} - ${result.section} ${result.numero}`,
      })

      await fetchParcelles()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue"
      toast({ title: "Erreur", description: message, variant: "destructive" })
    }
  }, [fetchParcelles, toast])

  // -- Edition de parcelle --
  const handleEditVertices = useCallback(() => {
    if (!selectedParcelle) return
    setEditingParcelle(selectedParcelle)
    setEditMode("vertices")
    setIsEditing(true)
  }, [selectedParcelle])

  const handleEditMove = useCallback(() => {
    if (!selectedParcelle) return
    setEditingParcelle(selectedParcelle)
    setEditMode("move")
    setIsEditing(true)
  }, [selectedParcelle])

  const handleEditConfirm = useCallback(() => {
    // Fire l'event custom sur la map pour récupérer la géométrie
    if (mapRef) {
      mapRef.fire("editing:confirm" as any)
    }
  }, [mapRef])

  const handleEditComplete = useCallback(async (newGeometry: string) => {
    if (!editingParcelle) return

    try {
      const res = await fetch(`/api/carte/${editingParcelle.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geometry: newGeometry }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || "Erreur lors de la mise a jour")
      }
      toast({
        title: "Parcelle modifiée",
        description: `Le trace de "${editingParcelle.nom}" a été mis à jour.`,
      })
      await fetchParcelles()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue"
      toast({ title: "Erreur", description: message, variant: "destructive" })
    } finally {
      setIsEditing(false)
      setEditingParcelle(null)
      setSelectedParcelle(null)
    }
  }, [editingParcelle, fetchParcelles, toast])

  const handleEditCancel = useCallback(() => {
    setIsEditing(false)
    setEditingParcelle(null)
  }, [])

  // -- FlyTo : centrer la carte sur une parcelle --
  const handleFlyTo = useCallback((parcelle: ParcelleGeoData) => {
    if (!mapRef) return

    try {
      const geo = JSON.parse(parcelle.geometry)
      const coords =
        geo.type === "MultiPolygon"
          ? geo.coordinates[0][0]
          : geo.coordinates[0]

      // Construire les bornes a partir des coordonnees [lng, lat]
      const latlngs = coords.map((c: [number, number]) => [c[1], c[0]] as [number, number])
      const bounds = (window as any).L.latLngBounds(latlngs)

      mapRef.flyToBounds(bounds, { padding: [50, 50], maxZoom: 18 })
      if (window.matchMedia('(max-width: 767px)').matches) setShowList(false)
    } catch {
      // Fallback : si le centroid est disponible dans les données
      console.warn("Impossible de parser la geometrie pour flyTo")
    }
  }, [mapRef])

  const handleMovementComplete = useCallback(async (destinationId: string) => {
    await fetchParcelles()
    setSelectedParcelle(null)
    const destination = parcelles.find((p) => p.id === destinationId)
    if (destination) handleFlyTo(destination)
    toast({ title: 'Lot déplacé', description: 'Le nouvel emplacement est enregistré.' })
  }, [fetchParcelles, handleFlyTo, parcelles, toast])

  // -- Fermer le panel --
  const handleClosePanel = useCallback(() => {
    setSelectedParcelle(null)
    setIsCreating(false)
    setNewGeometry(null)
  }, [])

  // -- Ouverture/fermeture du cadastre --
  const handleCadastreOpen = useCallback(() => {
    setShowCadastre((prev) => !prev)
  }, [])

  // -- Callback quand la carte est prete --
  const handleMapReady = useCallback((map: L.Map) => {
    setMapRef(map)
  }, [])

  // Determiner si le panneau droit est visible
  const isPanelOpen = selectedParcelle !== null || (isCreating && newGeometry !== null)

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="border-b bg-white z-50 flex-shrink-0">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={usageFilter === "elevage" || parcelleIdParam ? "/elevage?tab=animaux" : "/jardin"}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {usageFilter === "elevage" || parcelleIdParam ? "Élevage" : "Plan schématique"}
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <MapIcon className={`h-6 w-6 ${usageFilter === "elevage" || parcelleIdParam ? "text-amber-600" : "text-green-600"}`} />
              <h1 className="text-xl font-bold">Cartographie</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle liste */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowList((prev) => {
                const next = !prev
                if (next && window.matchMedia('(max-width: 767px)').matches) {
                  setSelectedParcelle(null)
                  setIsCreating(false)
                  setNewGeometry(null)
                }
                return next
              })}
              title={showList ? "Masquer la liste" : "Afficher la liste"}
            >
              {showList ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
              <span className="ml-2 hidden sm:inline">
                {showList ? "Masquer" : "Parcelles"}
              </span>
            </Button>
          </div>
        </div>
      </header>

      {/* Contenu principal */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Liste des parcelles (gauche) */}
        {showList && (
          <div className="absolute inset-0 z-40 md:static md:block md:flex-shrink-0">
            <ParcelleList
              parcelles={parcelles}
              selectedId={selectedParcelle?.id ?? null}
              onSelect={handleSelect}
              onFlyTo={handleFlyTo}
              className="w-full md:w-64"
            />
          </div>
        )}

        {/* Zone carte (centre) */}
        <div className="flex-1 relative">
          {loading ? (
            <div className="h-full w-full flex items-center justify-center bg-muted">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Barre d'outils au-dessus de la carte */}
              <MapToolbar
                onDrawStart={handleDrawStart}
                onCadastreOpen={handleCadastreOpen}
                isDrawing={isDrawing}
                onDrawCancel={handleDrawCancel}
                hasSelection={!!selectedParcelle && !isEditing}
                isEditing={isEditing}
                editMode={editMode}
                onEditVertices={handleEditVertices}
                onEditMove={handleEditMove}
                onEditConfirm={handleEditConfirm}
                onEditCancel={handleEditCancel}
              />

              {/* Carte Leaflet */}
              <MapContainer onMapReady={handleMapReady}>
                <ParcelleLayer
                  parcelles={parcelles}
                  onSelect={isEditing ? undefined : handleSelect}
                  editingId={isEditing ? editingParcelle?.id : undefined}
                />
                <DrawingTools
                  isDrawing={isDrawing}
                  onDrawComplete={handleDrawComplete}
                  onCancel={handleDrawCancel}
                />
                <EditingTools
                  isEditing={isEditing}
                  mode={editMode}
                  geometry={editingParcelle?.geometry ?? null}
                  couleur={editingParcelle?.couleur}
                  onEditComplete={handleEditComplete}
                  onCancel={handleEditCancel}
                />
                <GeolocateControl />
              </MapContainer>

              {/* Recherche cadastrale (panneau flottant) */}
              {showCadastre && (
                <CadastreSearch onImport={handleCadastreImport} />
              )}
            </>
          )}
        </div>

        {/* Panneau d'edition (droite) */}
        {isPanelOpen && (
          <div className="absolute inset-x-0 bottom-0 z-40 h-[72%] md:static md:h-auto md:flex-shrink-0 md:w-80">
            <ParcellePanel
              parcelle={selectedParcelle}
              isCreating={isCreating}
              newGeometry={newGeometry}
              onSave={handleSave}
              onDelete={handleDelete}
              onClose={handleClosePanel}
              parcelles={parcelles}
              onMovementComplete={handleMovementComplete}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default function CartePage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <CartePageContent />
    </Suspense>
  )
}
