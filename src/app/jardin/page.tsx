"use client"

/**
 * Page Plan du jardin - Visualisation 2D avec éditeur complet
 */

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, Map as MapIcon, Save, RotateCcw, ZoomIn, ZoomOut, Plus, Crosshair, Pencil, Trash2, X, RotateCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { GardenView } from "@/components/garden/GardenView"
import { useToast } from "@/hooks/use-toast"

interface PlancheWithCulture {
  id: string
  largeur: number | null
  longueur: number | null
  posX: number | null
  posY: number | null
  rotation2D: number | null
  ilot: string | null
  cultures: {
    id: number
    espece: {
      id: string
      couleur: string | null
      famille: { couleur: string | null } | null
    }
  }[]
}

interface ObjetJardin {
  id: number
  nom: string | null
  type: string
  largeur: number
  longueur: number
  posX: number
  posY: number
  rotation2D: number
  couleur: string | null
}

interface Espece {
  id: string
  couleur: string | null
}

const TYPES_OBJETS = [
  { value: "allee", label: "Allée", color: "#d4a574" },
  { value: "passage", label: "Passage", color: "#a8a29e" },
  { value: "bordure", label: "Bordure", color: "#78716c" },
  { value: "serre", label: "Serre", color: "#93c5fd" },
  { value: "compost", label: "Compost", color: "#854d0e" },
  { value: "eau", label: "Point d'eau", color: "#60a5fa" },
  { value: "autre", label: "Autre", color: "#d1d5db" },
]

export default function JardinPage() {
  const { toast } = useToast()
  const [planches, setPlanches] = React.useState<PlancheWithCulture[]>([])
  const [objets, setObjets] = React.useState<ObjetJardin[]>([])
  const [especes, setEspeces] = React.useState<Espece[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [editMode, setEditMode] = React.useState(false)
  const [scale, setScale] = React.useState(50)
  const [hasChanges, setHasChanges] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  // Sélection et édition
  const [selectedPlanche, setSelectedPlanche] = React.useState<string | null>(null)
  const [selectedObjet, setSelectedObjet] = React.useState<number | null>(null)
  const [showNewPlancheDialog, setShowNewPlancheDialog] = React.useState(false)
  const [showNewObjetDialog, setShowNewObjetDialog] = React.useState(false)
  const [newPlanche, setNewPlanche] = React.useState({ id: "", largeur: 0.8, longueur: 10 })
  const [newObjet, setNewObjet] = React.useState({ nom: "", type: "allee", largeur: 0.5, longueur: 5 })

  // Charger les planches
  const fetchPlanches = React.useCallback(async () => {
    try {
      const response = await fetch("/api/jardin")
      if (!response.ok) throw new Error("Erreur chargement")
      let data: PlancheWithCulture[] = await response.json()

      // Auto-positionner les planches sans position
      let needsPositioning = false
      const positioned = data.filter(p => p.posX !== null && p.posY !== null)
      const unpositioned = data.filter(p => p.posX === null || p.posY === null)

      if (unpositioned.length > 0) {
        needsPositioning = true
        // Trouver la prochaine position libre
        let maxY = 0
        positioned.forEach(p => {
          const bottom = (p.posY || 0) + (p.longueur || 2)
          if (bottom > maxY) maxY = bottom
        })

        unpositioned.forEach((p, i) => {
          p.posX = (i % 3) * 2
          p.posY = maxY + Math.floor(i / 3) * 3 + 0.5
        })
        data = [...positioned, ...unpositioned]
      }

      setPlanches(data)
      if (needsPositioning) setHasChanges(true)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger le plan du jardin"
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  // Charger les objets du jardin
  const fetchObjets = React.useCallback(async () => {
    try {
      const response = await fetch("/api/objets-jardin")
      if (!response.ok) return
      const data = await response.json()
      setObjets(data || [])
    } catch (error) {
      // Ignorer
    }
  }, [])

  // Charger les espèces pour la création de cultures
  const fetchEspeces = React.useCallback(async () => {
    try {
      const response = await fetch("/api/especes?pageSize=200")
      if (!response.ok) return
      const data = await response.json()
      setEspeces(data.data || [])
    } catch (error) {
      // Ignorer
    }
  }, [])

  React.useEffect(() => {
    fetchPlanches()
    fetchObjets()
    fetchEspeces()
  }, [fetchPlanches, fetchObjets, fetchEspeces])

  // Données de la planche sélectionnée
  const selectedPlancheData = planches.find(p => p.id === selectedPlanche)
  const selectedObjetData = objets.find(o => o.id === selectedObjet)

  // Déplacer une planche
  const handlePlancheMove = (id: string, x: number, y: number) => {
    setPlanches(prev => prev.map(p =>
      p.id === id ? { ...p, posX: x, posY: y } : p
    ))
    setHasChanges(true)
  }

  // Déplacer un objet
  const handleObjetMove = (id: number, x: number, y: number) => {
    setObjets(prev => prev.map(o =>
      o.id === id ? { ...o, posX: x, posY: y } : o
    ))
    setHasChanges(true)
  }

  // Sélectionner une planche
  const handlePlancheClick = (id: string) => {
    setSelectedPlanche(prev => prev === id ? null : id)
    if (id) setSelectedObjet(null)
  }

  // Sélectionner un objet
  const handleObjetClick = (id: number) => {
    setSelectedObjet(prev => prev === id ? null : id)
    if (id) setSelectedPlanche(null)
  }

  // Tourner une planche
  const handleRotatePlanche = (degrees: number) => {
    if (!selectedPlanche) return
    setPlanches(prev => prev.map(p =>
      p.id === selectedPlanche
        ? { ...p, rotation2D: ((p.rotation2D || 0) + degrees) % 360 }
        : p
    ))
    setHasChanges(true)
  }

  // Tourner un objet
  const handleRotateObjet = (degrees: number) => {
    if (!selectedObjet) return
    setObjets(prev => prev.map(o =>
      o.id === selectedObjet
        ? { ...o, rotation2D: (o.rotation2D + degrees) % 360 }
        : o
    ))
    setHasChanges(true)
  }

  // Sauvegarder les positions
  const handleSave = async () => {
    setSaving(true)
    try {
      const planchePromises = planches.map(p =>
        fetch(`/api/planches/${encodeURIComponent(p.id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            posX: p.posX,
            posY: p.posY,
            rotation2D: p.rotation2D
          })
        })
      )

      const objetPromises = objets.map(o =>
        fetch(`/api/objets-jardin/${o.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            posX: o.posX,
            posY: o.posY,
            rotation2D: o.rotation2D
          })
        })
      )

      await Promise.all([...planchePromises, ...objetPromises])

      toast({
        title: "Plan sauvegardé",
        description: "Les positions ont été enregistrées"
      })
      setHasChanges(false)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de sauvegarder le plan"
      })
    } finally {
      setSaving(false)
    }
  }

  // Réorganiser en grille
  const handleReset = () => {
    const cols = Math.ceil(Math.sqrt(planches.length))
    const spacing = 0.5
    setPlanches(prev => prev.map((p, i) => ({
      ...p,
      posX: (i % cols) * ((p.largeur || 0.8) + spacing),
      posY: Math.floor(i / cols) * ((p.longueur || 2) + spacing)
    })))
    setHasChanges(true)
  }

  // Recentrer la vue
  const handleRecenter = () => {
    // Reset scale et laisser le GardenView recalculer le viewBox
    setScale(50)
  }

  // Créer une nouvelle planche
  const handleCreatePlanche = async () => {
    if (!newPlanche.id.trim()) {
      toast({ variant: "destructive", title: "Nom requis" })
      return
    }

    try {
      // Trouver une position libre
      let maxY = 0
      planches.forEach(p => {
        const bottom = (p.posY || 0) + (p.longueur || 2)
        if (bottom > maxY) maxY = bottom
      })

      const response = await fetch("/api/planches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: newPlanche.id,
          largeur: newPlanche.largeur,
          longueur: newPlanche.longueur,
          surface: newPlanche.largeur * newPlanche.longueur,
          posX: 0,
          posY: maxY + 0.5
        })
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || "Erreur création")
      }

      toast({ title: "Planche créée", description: newPlanche.id })
      setShowNewPlancheDialog(false)
      setNewPlanche({ id: "", largeur: 0.8, longueur: 10 })
      fetchPlanches()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur inconnue"
      })
    }
  }

  // Supprimer la planche sélectionnée
  const handleDeletePlanche = async () => {
    if (!selectedPlanche) return
    if (!confirm(`Supprimer la planche "${selectedPlanche}" ?`)) return

    try {
      const response = await fetch(`/api/planches/${encodeURIComponent(selectedPlanche)}`, {
        method: "DELETE"
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || "Erreur suppression")
      }

      toast({ title: "Planche supprimée" })
      setSelectedPlanche(null)
      fetchPlanches()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur inconnue"
      })
    }
  }

  // Créer un nouvel objet
  const handleCreateObjet = async () => {
    try {
      // Trouver une position libre
      let maxY = 0
      planches.forEach(p => {
        const bottom = (p.posY || 0) + (p.longueur || 2)
        if (bottom > maxY) maxY = bottom
      })
      objets.forEach(o => {
        const bottom = o.posY + o.longueur
        if (bottom > maxY) maxY = bottom
      })

      const response = await fetch("/api/objets-jardin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: newObjet.nom || null,
          type: newObjet.type,
          largeur: newObjet.largeur,
          longueur: newObjet.longueur,
          posX: 0,
          posY: maxY + 0.5
        })
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || "Erreur création")
      }

      toast({ title: "Objet créé" })
      setShowNewObjetDialog(false)
      setNewObjet({ nom: "", type: "allee", largeur: 0.5, longueur: 5 })
      fetchObjets()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur inconnue"
      })
    }
  }

  // Supprimer l'objet sélectionné
  const handleDeleteObjet = async () => {
    if (!selectedObjet) return
    if (!confirm("Supprimer cet objet ?")) return

    try {
      const response = await fetch(`/api/objets-jardin/${selectedObjet}`, {
        method: "DELETE"
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || "Erreur suppression")
      }

      toast({ title: "Objet supprimé" })
      setSelectedObjet(null)
      fetchObjets()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur inconnue"
      })
    }
  }

  // Légende des couleurs
  const legendItems = React.useMemo(() => {
    const items = new Map<string, { color: string; name: string }>()
    planches.forEach(p => {
      if (p.cultures[0]) {
        const espece = p.cultures[0].espece
        const color = espece.couleur || espece.famille?.couleur || "#22c55e"
        items.set(espece.id, { color, name: espece.id })
      }
    })
    return Array.from(items.values())
  }, [planches])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Accueil
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <MapIcon className="h-6 w-6 text-green-600" />
              <h1 className="text-xl font-bold">Plan du jardin</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom */}
            <Button variant="outline" size="icon" onClick={() => setScale(s => Math.max(20, s - 10))}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm w-16 text-center">{scale}px/m</span>
            <Button variant="outline" size="icon" onClick={() => setScale(s => Math.min(100, s + 10))}>
              <ZoomIn className="h-4 w-4" />
            </Button>

            <div className="w-px h-6 bg-gray-300 mx-2" />

            {/* Recentrer */}
            <Button variant="outline" size="sm" onClick={handleRecenter}>
              <Crosshair className="h-4 w-4 mr-2" />
              Recentrer
            </Button>

            {/* Mode édition */}
            <div className="flex items-center gap-2 ml-2">
              <Switch id="edit-mode" checked={editMode} onCheckedChange={setEditMode} />
              <Label htmlFor="edit-mode">Éditer</Label>
            </div>

            {editMode && (
              <>
                <Button variant="outline" size="sm" onClick={() => setShowNewPlancheDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Planche
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowNewObjetDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Objet
                </Button>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Réorg.
                </Button>
                <Button size="sm" onClick={handleSave} disabled={!hasChanges || saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "..." : "Sauver"}
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-4">
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          {/* Plan */}
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="h-[600px] flex items-center justify-center text-muted-foreground">
                  Chargement...
                </div>
              ) : planches.length === 0 ? (
                <div className="h-[600px] flex flex-col items-center justify-center text-muted-foreground">
                  <MapIcon className="h-12 w-12 mb-4 opacity-50" />
                  <p>Aucune planche configurée</p>
                  <Button variant="link" onClick={() => setShowNewPlancheDialog(true)}>
                    Créer une planche
                  </Button>
                </div>
              ) : (
                <GardenView
                  planches={planches}
                  objets={objets}
                  editable={editMode}
                  selectedId={selectedPlanche}
                  selectedObjetId={selectedObjet}
                  onPlancheMove={handlePlancheMove}
                  onPlancheClick={handlePlancheClick}
                  onObjetMove={handleObjetMove}
                  onObjetClick={handleObjetClick}
                  scale={scale}
                />
              )}
            </CardContent>
          </Card>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Planche sélectionnée */}
            {selectedPlancheData ? (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{selectedPlancheData.id}</CardTitle>
                    <Button variant="ghost" size="icon" onClick={() => setSelectedPlanche(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Largeur:</span>
                      <span className="ml-1 font-medium">{selectedPlancheData.largeur || 0}m</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Longueur:</span>
                      <span className="ml-1 font-medium">{selectedPlancheData.longueur || 0}m</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Surface:</span>
                      <span className="ml-1 font-medium">
                        {((selectedPlancheData.largeur || 0) * (selectedPlancheData.longueur || 0)).toFixed(1)} m²
                      </span>
                    </div>
                  </div>

                  {selectedPlancheData.cultures.length > 0 ? (
                    <div>
                      <span className="text-sm text-muted-foreground">Culture:</span>
                      <div className="flex items-center gap-2 mt-1">
                        <div
                          className="w-4 h-4 rounded"
                          style={{
                            backgroundColor:
                              selectedPlancheData.cultures[0].espece.couleur ||
                              selectedPlancheData.cultures[0].espece.famille?.couleur ||
                              "#22c55e"
                          }}
                        />
                        <span className="font-medium">{selectedPlancheData.cultures[0].espece.id}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Aucune culture</p>
                  )}

                  {editMode && (
                    <div className="space-y-2 pt-2 border-t">
                      {/* Rotation */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Rotation: {selectedPlancheData.rotation2D || 0}°</span>
                        <div className="flex gap-1">
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleRotatePlanche(-15)}>
                            <RotateCcw className="h-3 w-3" />
                          </Button>
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleRotatePlanche(15)}>
                            <RotateCw className="h-3 w-3" />
                          </Button>
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleRotatePlanche(90)}>
                            90°
                          </Button>
                        </div>
                      </div>
                      {/* Actions */}
                      <div className="flex gap-2">
                        <Link href={`/cultures/new?planche=${encodeURIComponent(selectedPlancheData.id)}`} className="flex-1">
                          <Button variant="outline" size="sm" className="w-full">
                            <Plus className="h-4 w-4 mr-1" />
                            Culture
                          </Button>
                        </Link>
                        <Button variant="destructive" size="sm" onClick={handleDeletePlanche}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : selectedObjetData ? (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {selectedObjetData.nom || TYPES_OBJETS.find(t => t.value === selectedObjetData.type)?.label || "Objet"}
                    </CardTitle>
                    <Button variant="ghost" size="icon" onClick={() => setSelectedObjet(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: selectedObjetData.couleur || TYPES_OBJETS.find(t => t.value === selectedObjetData.type)?.color }}
                    />
                    <span className="text-sm capitalize">{TYPES_OBJETS.find(t => t.value === selectedObjetData.type)?.label}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Largeur:</span>
                      <span className="ml-1 font-medium">{selectedObjetData.largeur}m</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Longueur:</span>
                      <span className="ml-1 font-medium">{selectedObjetData.longueur}m</span>
                    </div>
                  </div>

                  {editMode && (
                    <div className="space-y-2 pt-2 border-t">
                      {/* Rotation */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Rotation: {selectedObjetData.rotation2D}°</span>
                        <div className="flex gap-1">
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleRotateObjet(-15)}>
                            <RotateCcw className="h-3 w-3" />
                          </Button>
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleRotateObjet(15)}>
                            <RotateCw className="h-3 w-3" />
                          </Button>
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleRotateObjet(90)}>
                            90°
                          </Button>
                        </div>
                      </div>
                      <Button variant="destructive" size="sm" onClick={handleDeleteObjet} className="w-full">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Supprimer
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  Cliquez sur un élément pour voir ses détails
                </CardContent>
              </Card>
            )}

            {/* Légende */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Cultures en cours</CardTitle>
              </CardHeader>
              <CardContent>
                {legendItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune culture active</p>
                ) : (
                  <ul className="space-y-1">
                    {legendItems.map(item => (
                      <li key={item.name} className="flex items-center gap-2 text-sm">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: item.color }} />
                        {item.name}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Stats */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Statistiques</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Planches</span>
                  <span className="font-medium">{planches.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cultivées</span>
                  <span className="font-medium">{planches.filter(p => p.cultures.length > 0).length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Surface</span>
                  <span className="font-medium">
                    {planches.reduce((sum, p) => sum + (p.largeur || 0) * (p.longueur || 0), 0).toFixed(1)} m²
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Instructions */}
            {editMode && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Aide</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground space-y-1">
                  <p>• Glissez les planches pour les déplacer</p>
                  <p>• Cliquez pour sélectionner et éditer</p>
                  <p>• Grille: 0.5m</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      {/* Dialog création planche */}
      <Dialog open={showNewPlancheDialog} onOpenChange={setShowNewPlancheDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle planche</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="planche-id">Nom</Label>
              <Input
                id="planche-id"
                value={newPlanche.id}
                onChange={e => setNewPlanche(p => ({ ...p, id: e.target.value }))}
                placeholder="Ex: P1, A-Nord..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="planche-largeur">Largeur (m)</Label>
                <Input
                  id="planche-largeur"
                  type="number"
                  step="0.1"
                  value={newPlanche.largeur}
                  onChange={e => setNewPlanche(p => ({ ...p, largeur: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <Label htmlFor="planche-longueur">Longueur (m)</Label>
                <Input
                  id="planche-longueur"
                  type="number"
                  step="0.1"
                  value={newPlanche.longueur}
                  onChange={e => setNewPlanche(p => ({ ...p, longueur: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              Surface: {(newPlanche.largeur * newPlanche.longueur).toFixed(1)} m²
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewPlancheDialog(false)}>Annuler</Button>
            <Button onClick={handleCreatePlanche}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog création objet */}
      <Dialog open={showNewObjetDialog} onOpenChange={setShowNewObjetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvel objet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="objet-type">Type</Label>
              <Select value={newObjet.type} onValueChange={v => setNewObjet(o => ({ ...o, type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES_OBJETS.map(t => (
                    <SelectItem key={t.value} value={t.value}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: t.color }} />
                        {t.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="objet-nom">Nom (optionnel)</Label>
              <Input
                id="objet-nom"
                value={newObjet.nom}
                onChange={e => setNewObjet(o => ({ ...o, nom: e.target.value }))}
                placeholder="Ex: Allée principale..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="objet-largeur">Largeur (m)</Label>
                <Input
                  id="objet-largeur"
                  type="number"
                  step="0.1"
                  value={newObjet.largeur}
                  onChange={e => setNewObjet(o => ({ ...o, largeur: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <Label htmlFor="objet-longueur">Longueur (m)</Label>
                <Input
                  id="objet-longueur"
                  type="number"
                  step="0.1"
                  value={newObjet.longueur}
                  onChange={e => setNewObjet(o => ({ ...o, longueur: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewObjetDialog(false)}>Annuler</Button>
            <Button onClick={handleCreateObjet}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
